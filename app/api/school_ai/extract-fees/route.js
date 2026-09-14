import { checkRole, Roles } from '../../../../utils/roles';
import { authWithFallback } from '../../lib/authWithFallback';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { resolveSchoolKey } from '../../lib/schoolScope';

// Construct Gemini instance
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
    try {
        const authResult = await authWithFallback(request, 'POST /api/school_ai/extract-fees');
        if (!authResult.success) {
            return authResult.response;
        }

        if ((await resolveSchoolKey()) === 'demo_master') {
            return NextResponse.json({ error: 'Fonctionnalité IA désactivée en mode démo pour éviter les surcoûts.' }, { status: 403 });
        }

        // 1. Role-Based Access Control (RBAC) - Restrict to Admin/Teacher
        const isAdmin = await checkRole(Roles.ADMIN, request);
        const isTeacher = await checkRole(Roles.TEACHER, request);

        if (!isAdmin && !isTeacher) {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'Configuration serveur incomplète (Clé IA manquante)' }, { status: 500 });
        }

        // 2. Image Parsing
        const formData = await request.formData();
        const file = formData.get('image');

        if (!file || !(file instanceof Blob)) {
            return NextResponse.json({ error: 'Image manquante ou format invalide' }, { status: 400 });
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const mimeType = file.type;

        // Immediately zero out the original ArrayBuffer to satisfy NFR-SEC-2 Data Ephemerality
        new Uint8Array(arrayBuffer).fill(0);

        if (!mimeType.startsWith('image/')) {
            buffer.fill(0);
            return NextResponse.json({ error: 'Le fichier doit être une image' }, { status: 400 });
        }

        // 3. Connect to Google Gemini Vision API with Structured Prompt
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.ARRAY,
                    description: "Liste des paiements de frais de scolarité extraits du document.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            nom: { type: SchemaType.STRING, description: "Nom complet de l'élève" },
                            argent: { type: SchemaType.NUMBER, description: "Montant payé en Francs (F). 0 si aucun montant." },
                            riz: { type: SchemaType.NUMBER, description: "Quantité payée en kilogrammes (kg) de riz. 0 si aucune quantité." },
                            date: { type: SchemaType.STRING, description: "Date du paiement, au format YYYY-MM-DD. Si aucune date n'est trouvée pour la ligne, laisse vide." },
                            confiance: { type: SchemaType.NUMBER, description: "Score de confiance global (0.0 à 1.0)" }
                        },
                        required: ["nom", "argent", "riz", "confiance"]
                    }
                }
            }
        });

        const prompt = `Tu es un assistant expert en OCR de documents financiers scolaires.
Analyse cette liste de paiements de scolarité ou ce reçu.
RÈGLES CRITIQUES :
1. Pour chaque élève ou chaque ligne de paiement, extrais son nom exact.
2. Extraire le montant d'argent payé (en Francs). S'il n'y a pas d'argent, mettre 0.
3. Extraire la quantité de riz payée (en kilos). S'il n'y a pas de riz, mettre 0.
4. Si une date est explicitement associée au paiement sur la même ligne ou dans le contexte immédiat, l'extraire au format YYYY-MM-DD. Sinon, laisser le champ vide ou omettre le champ date.
5. Score de confiance global par ligne obligatoire.`;

        const imageParts = [
            {
                inlineData: {
                    data: base64Image,
                    mimeType
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        let responseText = result.response.text();

        // Strip markdown code fences if Gemini provides them despite responseMimeType
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

        // 4. Data Validation
        let extractedData = [];
        try {
            extractedData = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Gemini a retourné un JSON invalide", parseError);
            return NextResponse.json({ error: "Le format de réponse de l'IA est invalide" }, { status: 502 });
        }

        if (!Array.isArray(extractedData)) {
            extractedData = [extractedData];
        }

        // Sanitize and validate
        const sanitizedData = extractedData.map(item => {
            let conf = parseFloat(item.confiance);
            if (isNaN(conf)) conf = 0.5;
            conf = Math.min(1, Math.max(0, conf));

            return {
                nom: item.nom || "Inconnu",
                argent: Math.max(0, parseInt(item.argent) || 0),
                riz: Math.max(0, parseFloat(item.riz) || 0),
                date: item.date || "",
                confiance: conf
            };
        });

        // 5. Ensure Security and Data Privacy (NFR-SEC-2)
        // Wipe Image buffer
        buffer.fill(0);

        return NextResponse.json({
            success: true,
            data: sanitizedData
        });

    } catch (error) {
        console.error('Erreur API Gemini extract-fees:', error);
        return NextResponse.json({
            error: 'Erreur lors du traitement de l\'image par l\'IA',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}

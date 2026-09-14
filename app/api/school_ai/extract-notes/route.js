import { checkRole, Roles } from '../../../../utils/roles';
import { authWithFallback } from '../../lib/authWithFallback';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { resolveSchoolKey } from '../../lib/schoolScope';

// Construct Gemini instance
// Make sure to add GEMINI_API_KEY to your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
    try {
        const authResult = await authWithFallback(request, 'POST /api/school_ai/extract-notes');
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
        const subjectsStr = formData.get('subjects');
        const subjects = subjectsStr ? JSON.parse(subjectsStr) : [];

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
        // Using gemini-2.5-flash for speed and vision capabilities
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.ARRAY,
                    description: "Liste des élèves avec leurs notes par matière extraites du document.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            nom: { type: SchemaType.STRING, description: "Nom complet de l'élève" },
                            notes: {
                                type: SchemaType.ARRAY,
                                description: "Liste des notes par matière",
                                items: {
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        matiere: { type: SchemaType.STRING, description: "Nom de la matière identifiée" },
                                        note: { type: SchemaType.NUMBER, description: "Note obtenue" }
                                    },
                                    required: ["matiere", "note"]
                                }
                            },
                            confiance: { type: SchemaType.NUMBER, description: "Score de confiance global (0.0 à 1.0)" }
                        },
                        required: ["nom", "notes", "confiance"]
                    }
                }
            }
        });

        const subjectsPrompt = subjects.length > 0
            ? `Les matières valides dans l'application sont : ${subjects.map(s => s.nom).join(', ')}. Essaie de faire correspondre les colonnes ou lignes du document à ces matières.`
            : "Identifie les matières présentes dans le document.";

        const prompt = `Tu es un assistant expert en OCR de documents scolaires.
Analyse ce relevé de notes. 
RÈGLES CRITIQUES :
1. Identifie TOUTES les colonnes de notes. Si deux colonnes ont des titres proches (ex: "MATH" et "COMPT" ou "FRANC" et "DICTEE"), traite-les comme des matières DISTINCTES.
2. Ne fusionne JAMAIS deux colonnes de notes dans une seule matière.
3. Pour chaque élève, extrais son nom exact et la liste complète de ses notes.
${subjectsPrompt}
4. Retourne uniquement les notes brutes. Ne calcule pas de moyennes.
5. Score de confiance global par élève obligatoire.`;

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
            buffer.fill(0);
            return NextResponse.json({ error: "Le format de réponse de l'IA est invalide" }, { status: 502 });
        }

        if (!Array.isArray(extractedData)) {
            extractedData = [extractedData];
        }

        // Sanitize and validate
        const sanitizedData = extractedData.map(item => {
            const sanitizedNotes = (item.notes || []).map(n => ({
                matiere: n.matiere || "Inconnue",
                note: Math.min(100, Math.max(0, parseFloat(n.note) || 0))
            }));

            let conf = parseFloat(item.confiance);
            if (isNaN(conf)) conf = 0.5;
            conf = Math.min(1, Math.max(0, conf));

            return {
                nom: item.nom || "Inconnu",
                notes: sanitizedNotes,
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
        console.error('Erreur API Gemini extract-notes:', error);
        return NextResponse.json({
            error: 'Erreur lors du traitement de l\'image par l\'IA',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}

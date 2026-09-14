import { checkRole, Roles } from '../../../../utils/roles';
import { authWithFallback } from '../../lib/authWithFallback';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { resolveSchoolKey } from '../../lib/schoolScope';

// Construct Gemini instance
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request) {
    try {
        const authResult = await authWithFallback(request, 'POST /api/school_ai/extract-schedule');
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
        const classeNiveau = formData.get('classeNiveau') || '';
        const classeAlias = formData.get('classeAlias') || '';

        if (!file || !(file instanceof Blob)) {
            return NextResponse.json({ error: 'Image ou PDF manquant ou format invalide' }, { status: 400 });
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = buffer.toString('base64');
        const mimeType = file.type;

        // Immediately zero out the original ArrayBuffer to satisfy NFR-SEC-2 Data Ephemerality
        new Uint8Array(arrayBuffer).fill(0);

        if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
            buffer.fill(0);
            return NextResponse.json({ error: 'Le fichier doit être une image ou un PDF' }, { status: 400 });
        }

        // 3. Connect to Google Gemini Vision API with Structured Prompt
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    description: "Résultat de l'extraction de l'emploi du temps.",
                    properties: {
                        isWrongClass: {
                            type: SchemaType.BOOLEAN,
                            description: "Vrai (true) si le document mentionne explicitement une classe différente de celle demandée. Faux (false) si c'est la bonne classe ou si aucune classe n'est précisée."
                        },
                        confidenceScore: {
                            type: SchemaType.INTEGER,
                            description: "Note de confiance de 1 à 10 sur la qualité et la lisibilité du document."
                        },
                        remarks: {
                            type: SchemaType.STRING,
                            description: "Remarques éventuelles de l'IA (ex: texte flou, classe incohérente, etc.). Laisser vide si tout est parfait."
                        },
                        events: {
                            type: SchemaType.ARRAY,
                            description: "Liste des blocs horaires extraits de l'emploi du temps.",
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                            jour: { 
                              type: SchemaType.INTEGER, 
                              description: "Jour de la semaine de 1 (Lundi) à 7 (Dimanche)."
                            },
                            startTime: { 
                              type: SchemaType.STRING, 
                              description: "Heure de début au format HH:MM (ex: 08:00)"
                            },
                            endTime: { 
                              type: SchemaType.STRING, 
                              description: "Heure de fin au format HH:MM (ex: 10:00)"
                            },
                            type: { 
                              type: SchemaType.STRING, 
                              description: "Le type de bloc : doit être exactement 'COURS' ou 'PAUSE'"
                            },
                            subjectName: { 
                              type: SchemaType.STRING, 
                              description: "Le nom de la matière (uniquement si type=COURS). Ne pas remplir pour une PAUSE."
                            }
                        },
                        required: ["jour", "startTime", "endTime", "type"]
                    }
                } // ferme events
            }, // ferme properties
            required: ["events"]
        } // ferme responseSchema
    } // ferme generationConfig
}); // ferme getGenerativeModel

        const subjectsPrompt = subjects.length > 0
            ? `Les matières valides dans l'application sont : ${subjects.map(s => s.nom).join(', ')}. Essaie de faire correspondre avec le nom exact de la matière.`
            : "Identifie les matières présentes dans le document.";

        const classeContext = classeNiveau 
            ? `Ce document peut concerner plusieurs classes jumelées. EXTRAIS UNIQUEMENT les horaires destinés à la classe : ${classeNiveau} ${classeAlias}. IGNORE les horaires des autres classes.` 
            : '';

        const prompt = `Tu es un assistant expert en OCR et analyse d'emplois du temps scolaires.
Analyse cette image ou ce PDF d'un emploi du temps. 
${classeContext}

RÈGLES CRITIQUES :
1. Extrait tous les blocs horaires (cours et pauses) pertinents.
2. "jour" doit être un nombre : Lundi = 1, Mardi = 2, Mercredi = 3, Jeudi = 4, Vendredi = 5, Samedi = 6, Dimanche = 7.
3. Les heures "startTime" et "endTime" doivent toujours être au format 24h HH:MM (ex: 08:30, 14:00).
4. Le champ "type" doit valoir "COURS" pour une leçon et "PAUSE" pour les récréations ou la pause déjeuner.
5. ${subjectsPrompt}
6. IMPORTANT : Les créneaux horaires ne doivent JAMAIS se chevaucher sur un même jour. Si deux cours semblent avoir lieu en même temps, garde uniquement celui qui concerne la classe ciblée.
7. Ne fusionne pas les blocs séparés, mais un long bloc de 08:00 à 10:00 reste un seul bloc.
8. Ne renvoie AUCUN format Markdown, uniquement un JSON valide contenant "events" et potentiellement "warning".`;

        const documentParts = [
            {
                inlineData: {
                    data: base64Image,
                    mimeType
                }
            }
        ];

        const result = await model.generateContent([prompt, ...documentParts]);
        let responseText = result.response.text();

        // Strip markdown code fences if Gemini provides them despite responseMimeType
        responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

        // 4. Data Validation
        let extractedData = { events: [] };
        try {
            extractedData = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Gemini a retourné un JSON invalide", parseError);
            buffer.fill(0);
            return NextResponse.json({ error: "Le format de réponse de l'IA est invalide" }, { status: 502 });
        }

        const eventsArray = Array.isArray(extractedData.events) ? extractedData.events : [];

        // Sanitize and validate
        const sanitizedData = eventsArray.map(item => {
            return {
                jour: parseInt(item.jour) || 1,
                startTime: item.startTime || "08:00",
                endTime: item.endTime || "09:00",
                type: (item.type === 'PAUSE') ? 'PAUSE' : 'COURS',
                subjectName: item.subjectName || ""
            };
        });

        // 5. Ensure Security and Data Privacy (NFR-SEC-2)
        // Wipe Image buffer
        buffer.fill(0);

        return NextResponse.json({
            success: true,
            data: sanitizedData,
            isWrongClass: extractedData.isWrongClass || false,
            confidenceScore: extractedData.confidenceScore || 10,
            remarks: extractedData.remarks || ""
        });

    } catch (error) {
        console.error('Erreur API Gemini extract-schedule:', error);
        return NextResponse.json({
            error: "Erreur lors du traitement de l'emploi du temps par l'IA",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
    }
}

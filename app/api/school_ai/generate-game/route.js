import { checkRole, Roles } from '../../../../utils/roles';
import { authWithFallback } from '../../lib/authWithFallback';
import dbConnect from '../../lib/dbConnect';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const mongoose = require('mongoose');
const EducationalGame = require('../../_/models/ai/EducationalGame');
import { resolveSchoolKey } from '../../lib/schoolScope';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * POST /api/school_ai/generate-game
 * Génère un jeu pédagogique (QCM) à partir d'un PDF de cours, via Gemini.
 * Réservé aux CM1/CM2 (cycle de consolidation). FormData :
 *   - file : le PDF (ou image)
 *   - level : 'CM1' | 'CM2'
 *   - classId : (optionnel) classe d'origine
 * Réservé admin/prof.
 */
export async function POST(request) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/school_ai/generate-game');
    if (!authResult.success) return authResult.response;

    if ((await resolveSchoolKey()) === 'demo_master') {
        return NextResponse.json({ error: 'Fonctionnalité IA désactivée en mode démo pour éviter les surcoûts.' }, { status: 403 });
    }

    const isAdmin = await checkRole(Roles.ADMIN, request);
    const isTeacher = await checkRole(Roles.TEACHER, request);
    if (!isAdmin && !isTeacher) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Configuration serveur incomplète (Clé IA manquante)' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const level = (formData.get('level') || '').toString();
    const classId = formData.get('classId');

    if (!['CM1', 'CM2'].includes(level)) {
      return NextResponse.json({ error: 'La génération IA est réservée aux niveaux CM1 et CM2' }, { status: 400 });
    }
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Fichier PDF manquant ou invalide' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type;
    new Uint8Array(arrayBuffer).fill(0);

    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      buffer.fill(0);
      return NextResponse.json({ error: 'Le fichier doit être un PDF ou une image' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          description: 'Un jeu-questionnaire (QCM) généré à partir du document.',
          properties: {
            title: { type: SchemaType.STRING, description: "Titre court et parlant du jeu (ex: 'Quiz - La Révolution française')." },
            questions: {
              type: SchemaType.ARRAY,
              description: 'Liste de questions à choix multiple.',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  question: { type: SchemaType.STRING, description: "L'énoncé de la question." },
                  options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '3 à 4 réponses possibles.' },
                  answerIndex: { type: SchemaType.INTEGER, description: "Index (0-based) de la bonne réponse dans 'options'." },
                },
                required: ['question', 'options', 'answerIndex'],
              },
            },
          },
          required: ['title', 'questions'],
        },
      },
    });

    const prompt = `Tu es un enseignant de primaire. À partir du document fourni (cours, texte ou fiche d'exercices),
crée un jeu-questionnaire (QCM) adapté à des élèves de ${level}.
RÈGLES :
1. Génère entre 5 et 8 questions claires, en français, adaptées au niveau ${level}.
2. Chaque question a 3 ou 4 propositions ('options'), dont UNE SEULE correcte.
3. 'answerIndex' est l'index (commençant à 0) de la bonne réponse dans 'options'.
4. Varie les types : compréhension de texte, vocabulaire, culture générale/histoire selon le contenu.
5. Donne un 'title' court et engageant.
6. Réponds UNIQUEMENT en JSON valide conforme au schéma.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType } },
    ]);
    buffer.fill(0);

    let parsed;
    try {
      parsed = JSON.parse(result.response.text());
    } catch (e) {
      return NextResponse.json({ error: "La génération IA n'a pas renvoyé un format exploitable" }, { status: 502 });
    }

    // Validation/normalisation du contenu.
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const cleaned = questions
      .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2)
      .map((q) => ({
        question: q.question.trim(),
        options: q.options.map((o) => String(o)),
        answerIndex: Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < q.options.length ? q.answerIndex : 0,
      }));

    if (cleaned.length === 0) {
      return NextResponse.json({ error: 'Aucune question exploitable générée. Essayez un autre document.' }, { status: 422 });
    }

    await dbConnect();

    const game = await EducationalGame.create({
      title: (parsed.title && String(parsed.title).trim()) || `Quiz ${level}`,
      level,
      type: 'AI_GENERATED',
      classId: classId && mongoose.Types.ObjectId.isValid(classId) ? classId : null,
      content: { questions: cleaned },
      createdBy: authResult.userId || null,
    });

    return NextResponse.json({ success: true, data: game }, { status: 201 });
  } catch (error) {
    console.error('❌ [API] POST /api/school_ai/generate-game:', error);
    return NextResponse.json({ error: 'Erreur lors de la génération du jeu' }, { status: 500 });
  }
}

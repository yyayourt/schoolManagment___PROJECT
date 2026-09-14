import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import Stage3emeRaw from '../../_/models/ai/Stage3eme';
import EleveRaw from '../../_/models/ai/Eleve';
import ClasseRaw from '../../_/models/ai/Classe';
import TeacherRaw from '../../_/models/ai/Teacher';
import { generateStagesForClassYear } from '../../admin/reset-demo/lib/stageSeeder';

const Stage3eme = Stage3emeRaw.default || Stage3emeRaw;
const Eleve = EleveRaw.default || EleveRaw;
const Classe = ClasseRaw.default || ClasseRaw;
const Teacher = TeacherRaw.default || TeacherRaw;

export async function GET(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';

    const { searchParams } = new URL(req.url);
    const eleveId = searchParams.get('eleveId');
    const classeId = searchParams.get('classeId');
    const annee = searchParams.get('annee') || '2023-2024';

    if (eleveId) {
      const data = await Stage3eme.findOne({ schoolKey, eleveId, annee });
      return NextResponse.json({ success: true, data });
    }

    if (classeId) {
      const eleves = await Eleve.find({ current_classe: classeId });
      const eleveIds = eleves.map(e => e._id);

      let list = await Stage3eme.find({
        schoolKey,
        annee,
        eleveId: { $in: eleveIds }
      });

      // Auto-génération des données de démonstration de stage de 3ème si aucune donnée n'existe encore
      if (list.length === 0 && eleves.length > 0 && ['ecole_st_martin', 'demo_master'].includes(schoolKey)) {
        const classeDoc = await Classe.findById(classeId);
        if (classeDoc && (classeDoc.niveau === '3ème' || !classeDoc.niveau)) {
          const teachersList = await Teacher.find({ schoolKey });
          await generateStagesForClassYear(
            classeDoc,
            eleves,
            annee,
            schoolKey,
            teachersList.length ? teachersList : [{ nom: 'Martin' }]
          );

          list = await Stage3eme.find({
            schoolKey,
            annee,
            eleveId: { $in: eleveIds }
          });
        }
      }

      return NextResponse.json({ success: true, data: list });
    }

    return NextResponse.json({ success: false, error: 'eleveId ou classeId requis' }, { status: 400 });
  } catch (error) {
    console.error('Erreur GET /api/school_ai/stage:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';
    const body = await req.json();

    const {
      eleveId,
      annee = '2023-2024',
      entreprise,
      dates,
      statutConvention,
      suiviVisite,
      evaluation
    } = body;

    if (!eleveId) {
      return NextResponse.json({ success: false, error: 'eleveId est requis' }, { status: 400 });
    }

    // Calcul automatique de la moyenne du stage sur 20 s'il y a des notes
    let moyenneStage = null;
    if (evaluation) {
      const notes = [
        evaluation.noteEntreprise,
        evaluation.noteRapport,
        evaluation.noteSoutenance
      ].filter(n => n !== null && n !== undefined && n !== '');

      if (notes.length > 0) {
        const sum = notes.reduce((acc, curr) => acc + Number(curr), 0);
        moyenneStage = Math.round((sum / notes.length) * 10) / 10;
      }
    }

    const updatedData = await Stage3eme.findOneAndUpdate(
      { schoolKey, eleveId, annee },
      {
        $set: {
          entreprise: entreprise || {},
          dates: dates || {},
          statutConvention: statutConvention || 'EN_ATTENTE_RECHERCHE',
          suiviVisite: suiviVisite || {},
          evaluation: {
            ...evaluation,
            moyenneStage
          }
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('Erreur POST /api/school_ai/stage:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

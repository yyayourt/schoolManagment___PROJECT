import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import Orientation3emeRaw from '../../_/models/ai/Orientation3eme';
import EleveRaw from '../../_/models/ai/Eleve';

const Orientation3eme = Orientation3emeRaw.default || Orientation3emeRaw;
const Eleve = EleveRaw.default || EleveRaw;

export async function GET(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';

    const { searchParams } = new URL(req.url);
    const eleveId = searchParams.get('eleveId');
    const classeId = searchParams.get('classeId');
    const annee = searchParams.get('annee') || '2023-2024';

    if (eleveId) {
      const data = await Orientation3eme.findOne({ schoolKey, eleveId, annee });
      return NextResponse.json({ success: true, data });
    }

    if (classeId) {
      const eleves = await Eleve.find({ current_classe: classeId });
      const eleveIds = eleves.map(e => e._id);

      let list = await Orientation3eme.find({
        schoolKey,
        annee,
        eleveId: { $in: eleveIds }
      });

      // Auto-seeding si vide pour l'environnement démo
      if (list.length === 0 && eleves.length > 0 && ['ecole_st_martin', 'demo_master'].includes(schoolKey)) {
        const { generateOrientationForClassYear } = await import('../../admin/reset-demo/lib/orientationSeeder');
        await generateOrientationForClassYear({ niveau: '3ème' }, eleves, annee, schoolKey);
        list = await Orientation3eme.find({
          schoolKey,
          annee,
          eleveId: { $in: eleveIds }
        });
      }

      return NextResponse.json({ success: true, data: list });
    }

    return NextResponse.json({ success: false, error: 'eleveId ou classeId requis' }, { status: 400 });
  } catch (error) {
    console.error('Erreur GET /api/school_ai/orientation:', error);
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
      voeuxFamille,
      avisConseilClasse,
      decisionChefEtablissement,
      entretienOrientation
    } = body;

    if (!eleveId) {
      return NextResponse.json({ success: false, error: 'eleveId est requis' }, { status: 400 });
    }

    const updatedData = await Orientation3eme.findOneAndUpdate(
      { schoolKey, eleveId, annee },
      {
        $set: {
          voeuxFamille: voeuxFamille || [],
          avisConseilClasse: avisConseilClasse || { avis: 'EN_ATTENTE', commentaire: '' },
          decisionChefEtablissement: decisionChefEtablissement || { voieRetenue: 'EN_ATTENTE', accordFamille: false },
          entretienOrientation: entretienOrientation || { realise: false, compteRendu: '' }
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('Erreur POST /api/school_ai/orientation:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

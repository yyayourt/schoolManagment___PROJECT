import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import SocleEvaluation from '../../_/models/ai/SocleEvaluation';
import Eleve from '../../_/models/ai/Eleve';

export async function GET(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';

    const { searchParams } = new URL(req.url);
    const eleveId = searchParams.get('eleveId');
    const classeId = searchParams.get('classeId');
    const annee = searchParams.get('annee') || '2023-2024';

    if (eleveId) {
      const evalData = await SocleEvaluation.findOne({ schoolKey, eleveId, annee });
      return NextResponse.json({ success: true, data: evalData });
    }

    if (classeId) {
      const eleves = await Eleve.find({ current_classe: classeId }, '_id');
      const eleveIds = eleves.map(e => e._id);

      const evalDatas = await SocleEvaluation.find({
        schoolKey,
        annee,
        eleveId: { $in: eleveIds }
      });

      return NextResponse.json({ success: true, data: evalDatas });
    }

    return NextResponse.json({ success: false, error: 'eleveId ou classeId requis' }, { status: 400 });
  } catch (error) {
    console.error('Erreur GET /api/school_ai/socle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';
    const body = await req.json();

    const { eleveId, annee = '2023-2024', evaluations, appreciationGlobale } = body;

    if (!eleveId) {
      return NextResponse.json({ success: false, error: 'eleveId est requis' }, { status: 400 });
    }

    const evalData = await SocleEvaluation.findOneAndUpdate(
      { schoolKey, eleveId, annee },
      {
        $set: {
          evaluations: evaluations || {},
          appreciationGlobale: appreciationGlobale || ''
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, data: evalData });
  } catch (error) {
    console.error('Erreur POST /api/school_ai/socle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

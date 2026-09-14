import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import DnbSimulation from '../../_/models/ai/DnbSimulation';
import SocleEvaluation from '../../_/models/ai/SocleEvaluation';
import Eleve from '../../_/models/ai/Eleve';

// Helper pour calculer la mention selon le score total sur 800
function getMentionDnb(scoreTotal) {
  if (scoreTotal >= 640) return 'TRES_BIEN';
  if (scoreTotal >= 560) return 'BIEN';
  if (scoreTotal >= 480) return 'ASSEZ_BIEN';
  if (scoreTotal >= 400) return 'ADMIS';
  return 'REFUSE';
}

export async function GET(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';

    const { searchParams } = new URL(req.url);
    const eleveId = searchParams.get('eleveId');
    const classeId = searchParams.get('classeId');
    const annee = searchParams.get('annee') || '2023-2024';

    if (eleveId) {
      const dnbData = await DnbSimulation.findOne({ schoolKey, eleveId, annee });
      const socleData = await SocleEvaluation.findOne({ schoolKey, eleveId, annee });

      return NextResponse.json({
        success: true,
        data: {
          dnb: dnbData,
          socle: socleData
        }
      });
    }

    if (classeId) {
      const eleves = await Eleve.find({ current_classe: classeId }, '_id');
      const eleveIds = eleves.map(e => e._id);

      const dnbList = await DnbSimulation.find({
        schoolKey,
        annee,
        eleveId: { $in: eleveIds }
      });

      const socleList = await SocleEvaluation.find({
        schoolKey,
        annee,
        eleveId: { $in: eleveIds }
      });

      return NextResponse.json({
        success: true,
        data: {
          dnbList,
          socleList
        }
      });
    }

    return NextResponse.json({ success: false, error: 'eleveId ou classeId requis' }, { status: 400 });
  } catch (error) {
    console.error('Erreur GET /api/school_ai/dnb:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';
    const body = await req.json();

    const { eleveId, annee = '2023-2024', epreuves = {}, ptsSocleCustom = null, commentaires = '' } = body;

    if (!eleveId) {
      return NextResponse.json({ success: false, error: 'eleveId est requis' }, { status: 400 });
    }

    // Calculer le total des épreuves finales
    const ptsEpreuves = (Number(epreuves.francais) || 0) +
                        (Number(epreuves.mathematiques) || 0) +
                        (Number(epreuves.histoireGeo) || 0) +
                        (Number(epreuves.sciences) || 0) +
                        (Number(epreuves.oral) || 0) +
                        (Number(epreuves.optionBonus) || 0);

    // Calculer ou récupérer les points du socle
    let ptsSocle = 0;
    if (ptsSocleCustom !== null && ptsSocleCustom !== undefined && ptsSocleCustom !== '') {
      ptsSocle = Number(ptsSocleCustom);
    } else {
      const socleData = await SocleEvaluation.findOne({ schoolKey, eleveId, annee });
      if (socleData && socleData.evaluations) {
        const DOMAINES_PTS = { INSUFFISANT: 10, FRAGILE: 25, SATISFAISANT: 40, TRES_BON: 50 };
        const evals = socleData.evaluations instanceof Map ? Object.fromEntries(socleData.evaluations) : socleData.evaluations;
        Object.values(evals || {}).forEach((val) => {
          ptsSocle += (DOMAINES_PTS[val] || 0);
        });
      }
    }

    const noteFinalCalculated = ptsSocle + ptsEpreuves;
    const mentionEstimee = getMentionDnb(noteFinalCalculated);

    const dnbData = await DnbSimulation.findOneAndUpdate(
      { schoolKey, eleveId, annee },
      {
        $set: {
          epreuves,
          ptsSocleCustom,
          noteFinalCalculated,
          mentionEstimee,
          commentaires
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, data: dnbData });
  } catch (error) {
    console.error('Erreur POST /api/school_ai/dnb:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

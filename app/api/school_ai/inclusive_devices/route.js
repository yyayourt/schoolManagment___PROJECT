import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import InclusiveDeviceRaw from '../../_/models/ai/InclusiveDevice';
import EleveRaw from '../../_/models/ai/Eleve';
import ClasseRaw from '../../_/models/ai/Classe';
import { generateInclusiveDevicesForClassYear } from '../../admin/reset-demo/lib/inclusiveDeviceSeeder';

const InclusiveDevice = InclusiveDeviceRaw.default || InclusiveDeviceRaw;
const Eleve = EleveRaw.default || EleveRaw;
const Classe = ClasseRaw.default || ClasseRaw;

export async function GET(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';

    const { searchParams } = new URL(req.url);
    const eleveId = searchParams.get('eleveId');
    const classeId = searchParams.get('classeId');
    const annee = searchParams.get('annee') || '2023-2024';

    if (eleveId) {
      const data = await InclusiveDevice.findOne({ schoolKey, eleveId, annee });
      return NextResponse.json({ success: true, data });
    }

    if (classeId) {
      const eleves = await Eleve.find({ current_classe: classeId });
      const eleveIds = eleves.map(e => e._id);

      let list = await InclusiveDevice.find({
        schoolKey,
        annee,
        eleveId: { $in: eleveIds }
      });

      // Auto-génération des données de démonstration pour les clés démo si vide
      if (list.length === 0 && eleves.length > 0 && ['ecole_st_martin', 'demo_master'].includes(schoolKey)) {
        const classeDoc = await Classe.findById(classeId);
        if (classeDoc) {
          await generateInclusiveDevicesForClassYear(classeDoc, eleves, annee, schoolKey);
          list = await InclusiveDevice.find({
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
    console.error('Erreur GET /api/school_ai/inclusive_devices:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';
    const body = await req.json();

    const { eleveId, annee = '2023-2024', devices } = body;

    if (!eleveId) {
      return NextResponse.json({ success: false, error: 'eleveId est requis' }, { status: 400 });
    }

    const updatedData = await InclusiveDevice.findOneAndUpdate(
      { schoolKey, eleveId, annee },
      {
        $set: {
          devices: devices || []
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('Erreur POST /api/school_ai/inclusive_devices:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

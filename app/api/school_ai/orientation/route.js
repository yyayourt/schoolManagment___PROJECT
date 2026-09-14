import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import { requireFamilyScope, canAccessStudent, forbiddenStudent, narrowToScope } from '../../lib/familyScope';
import Orientation3emeRaw from '../../_/models/ai/Orientation3eme';
import EleveRaw from '../../_/models/ai/Eleve';

const Orientation3eme = Orientation3emeRaw.default || Orientation3emeRaw;
const Eleve = EleveRaw.default || EleveRaw;

export async function GET(req) {
  try {
    // Lecture réservée aux comptes connectés ; une famille ne voit que ses enfants.
    const scope = await requireFamilyScope(req);
    if (scope.error) return scope.error;

    await dbConnect();
    const schoolKey = req.headers.get('x-school-key') || 'ecole_st_martin';

    const { searchParams } = new URL(req.url);
    const eleveId = searchParams.get('eleveId');
    const classeId = searchParams.get('classeId');
    const annee = searchParams.get('annee') || '2023-2024';

    if (eleveId) {
      if (!canAccessStudent(scope, eleveId)) return forbiddenStudent();
      const data = await Orientation3eme.findOne({ schoolKey, eleveId, annee });
      return NextResponse.json({ success: true, data });
    }

    if (classeId) {
      const eleves = await Eleve.find({ current_classe: classeId });
      const eleveIds = eleves.map(e => e._id);
      const scopedIds = narrowToScope(scope, eleveIds);

      let list = await Orientation3eme.find({
        schoolKey,
        annee,
        eleveId: { $in: scopedIds }
      });

      // Auto-seeding si vide pour l'environnement démo. Le test porte sur la
      // classe entière : sinon une lecture parent relancerait le seeding.
      const existingForClass = await Orientation3eme.countDocuments({
        schoolKey,
        annee,
        eleveId: { $in: eleveIds }
      });
      if (existingForClass === 0 && eleves.length > 0 && ['ecole_st_martin', 'demo_master'].includes(schoolKey)) {
        const { generateOrientationForClassYear } = await import('../../admin/reset-demo/lib/orientationSeeder');
        await generateOrientationForClassYear({ niveau: '3ème' }, eleves, annee, schoolKey);
        list = await Orientation3eme.find({
          schoolKey,
          annee,
          eleveId: { $in: scopedIds }
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
    const scope = await requireFamilyScope(req);
    if (scope.error) return scope.error;

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

    if (!canAccessStudent(scope, eleveId)) return forbiddenStudent();

    // Une famille saisit ses vœux (cf. §16 de la spec collège) mais ne décide
    // ni de l'avis du conseil, ni de la décision du chef d'établissement,
    // ni du compte rendu d'entretien : ces champs restent au personnel.
    const $set = { voeuxFamille: voeuxFamille || [] };
    if (scope.isStaff) {
      $set.avisConseilClasse = avisConseilClasse || { avis: 'EN_ATTENTE', commentaire: '' };
      $set.decisionChefEtablissement = decisionChefEtablissement || { voieRetenue: 'EN_ATTENTE', accordFamille: false };
      $set.entretienOrientation = entretienOrientation || { realise: false, compteRendu: '' };
    }

    const updatedData = await Orientation3eme.findOneAndUpdate(
      { schoolKey, eleveId, annee },
      { $set },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('Erreur POST /api/school_ai/orientation:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

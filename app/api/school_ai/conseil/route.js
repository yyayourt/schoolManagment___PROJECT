import dbConnect from '../../lib/dbConnect';
import ConseilClasse from '../../_/models/ai/ConseilClasse';
import { NextResponse } from 'next/server';
import { getAuthAndRole } from '../../../../utils/roles';
import { resolveSchoolKey } from '../../lib/schoolScope';

export async function GET(request) {
  try {
    const { success, isAdmin, isTeacher } = await getAuthAndRole(request);
    if (!success) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }
    // Les délibérations (mentions, appréciations, avis d'orientation) portent sur
    // toute la classe : lecture réservée au personnel, pas aux familles.
    if (!isAdmin && !isTeacher) {
      return NextResponse.json({ error: 'Accès non autorisé (Réservé au personnel éducatif)' }, { status: 403 });
    }

    await dbConnect();

    const schoolKey = await resolveSchoolKey();

    const { searchParams } = new URL(request.url);
    const classeId = searchParams.get('classeId');
    const trimestre = searchParams.get('trimestre');
    const annee = searchParams.get('annee');

    const query = { schoolKey };
    if (classeId) query.classeId = classeId;
    if (trimestre) query.trimestre = parseInt(trimestre);
    if (annee) query.annee = annee;

    const conseils = await ConseilClasse.find(query)
      .populate('classeId', 'alias niveau annee')
      .populate('presents', 'nom prenoms email')
      .populate('decisions.eleveId', 'nom prenoms photo')
      .sort({ dateConseil: -1 });

    return NextResponse.json(conseils);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des conseils de classe', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { success, isAdmin, isTeacher } = await getAuthAndRole(request);
    if (!success || (!isAdmin && !isTeacher)) {
      return NextResponse.json({ error: 'Accès non autorisé (Seuls les profs et admins peuvent enregistrer un conseil)' }, { status: 403 });
    }

    await dbConnect();

    const schoolKey = await resolveSchoolKey();

    const body = await request.json();
    const { classeId, trimestre, annee, dateConseil, presents, decisions, compteRendu } = body;

    if (!classeId || !trimestre || !annee) {
      return NextResponse.json({ error: 'classeId, trimestre et annee sont requis' }, { status: 400 });
    }

    const conseil = await ConseilClasse.findOneAndUpdate(
      { schoolKey, classeId, trimestre: parseInt(trimestre), annee },
      {
        $set: {
          schoolKey,
          classeId,
          trimestre: parseInt(trimestre),
          annee,
          dateConseil: dateConseil || new Date(),
          presents: presents || [],
          decisions: decisions || [],
          compteRendu: compteRendu || ''
        }
      },
      { upsert: true, new: true, runValidators: true }
    )
      .populate('classeId', 'alias niveau annee')
      .populate('decisions.eleveId', 'nom prenoms photo');

    return NextResponse.json(conseil, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de l enregistrement du conseil de classe', details: error.message }, { status: 500 });
  }
}

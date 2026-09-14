import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import { requireFamilyScope } from '../../lib/familyScope';
import { normaliserConfiguration, genererEcole } from '../../lib/schoolGenerator';

/**
 * POST /api/school_ai/generate
 * Peuple l'école courante (décidée côté serveur, cf. schoolScope.js) à partir du formulaire de
 * génération de l'administration : matières, enseignants, classes, élèves,
 * et en option notes + emplois du temps. Les entités existantes sont
 * conservées, les nouvelles s'y ajoutent.
 */
export async function POST(request) {
  try {
    const scope = await requireFamilyScope(request, { adminOnly: true });
    if (scope.error) return scope.error;

    let body;
    try { body = await request.json(); } catch { body = {}; }

    let config;
    try {
      config = normaliserConfiguration(body);
    } catch (err) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }

    await dbConnect();

    const schoolKey = scope.schoolKey;

    const result = await genererEcole(config, {
      schoolKey,
      ownerClerkId: scope.auth.userId,
      isReal: schoolKey.startsWith('school_') || schoolKey === 'ecole_st_martin',
      createdBy: scope.auth.userId,
    });

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.counts.classes} classe(s), ${result.counts.eleves} élève(s) et ${result.counts.enseignants} enseignant(s) générés.`,
    });
  } catch (err) {
    console.error('❌ Failed to generate school:', err);
    return NextResponse.json({ success: false, error: 'Erreur lors de la génération de l\'école', details: err.message }, { status: 500 });
  }
}

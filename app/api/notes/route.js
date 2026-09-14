import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import dbConnect from '../lib/dbConnect'
import { authWithFallback } from '../lib/authWithFallback'
import { getAuthAndRole } from '../../../utils/roles'
import { resolveFamilyScope } from '../lib/familyScope'

const Note = require('../_/models/ai/Note')
import { resolveSchoolKey } from '../lib/schoolScope';

/**
 * GET /api/notes?eleveId=…&limit=…
 * Dernières notes d'un élève (widget « 3 dernières notes » des portails famille).
 * Un parent/élève ne peut lire que les notes des élèves qui lui sont rattachés.
 */
export async function GET(request) {
  try {
    const auth = await getAuthAndRole(request)
    if (!auth.success) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 })
    }

    await dbConnect()
    const schoolKey = await resolveSchoolKey()

    const { searchParams } = new URL(request.url)
    const eleveId = searchParams.get('eleveId')
    const limit = Math.min(parseInt(searchParams.get('limit'), 10) || 5, 50)

    if (!eleveId) {
      return NextResponse.json({ error: 'eleveId est requis' }, { status: 400 })
    }

    const { allowedStudentIds } = await resolveFamilyScope(auth)
    if (allowedStudentIds && !allowedStudentIds.includes(String(eleveId))) {
      return NextResponse.json({ error: 'Accès non autorisé à cet élève' }, { status: 403 })
    }

    const notes = await Note.find({ schoolKey, eleveId })
      .sort({ dateEvaluation: -1, createdAt: -1 })
      .limit(limit)
      .lean()

    return NextResponse.json({ success: true, data: notes })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/notes')
    if (!authResult.success) return authResult.response

    await dbConnect()
    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { notes, devoirId } = await request.json()
    if (!notes || !Array.isArray(notes) || !devoirId) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }

    // On supprime d'abord toutes les notes existantes pour ce devoir (pour permettre l'édition)
    await Note.deleteMany({ schoolKey, devoirId })

    // On prépare les nouvelles notes
    const notesToInsert = notes.map(n => ({
      ...n,
      schoolKey,
      devoirId
    }))

    if (notesToInsert.length > 0) {
      await Note.insertMany(notesToInsert)
    }

    return NextResponse.json({ success: true, count: notesToInsert.length })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

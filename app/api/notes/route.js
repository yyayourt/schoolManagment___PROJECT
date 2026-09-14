import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import dbConnect from '../lib/dbConnect'
import { authWithFallback } from '../lib/authWithFallback'

const Note = require('../_/models/ai/Note')

export async function POST(request) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/notes')
    if (!authResult.success) return authResult.response

    await dbConnect()
    const cookieStore = await cookies()
    const schoolKey = cookieStore.get('x-school-key')?.value
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

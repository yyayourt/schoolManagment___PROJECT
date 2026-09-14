import { NextResponse } from 'next/server'
import { authWithFallback } from '../../lib/authWithFallback'
import dbConnect from '../../lib/dbConnect'

const AttendanceEntry = require('../../_/models/ai/AttendanceEntry')

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']

/**
 * PUT /api/attendance/{entryId}
 * Met à jour le statut, le commentaire, ou le justificatif d'une absence/retard.
 * Body possible :
 *  - { status?, comment? }
 *  - { justificationNote } (Soumission par un parent)
 *  - { justificationAction: 'ACCEPT' | 'REJECT' } (Validation par la Vie Scolaire / CPE)
 */
export async function PUT(request, { params }) {
  try {
    const authResult = await authWithFallback(request, 'PUT /api/attendance/[entryId]')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const { entryId } = await params
    const body = await request.json()
    const { status, comment, justificationNote, justificationAction } = body || {}

    const update = {}

    if (status !== undefined) {
      if (!STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: 'status invalide' },
          { status: 400 }
        )
      }
      update.status = status
    }

    if (comment !== undefined) {
      update.comment = typeof comment === 'string' ? comment.trim() : ''
    }

    // Soumission de justificatif par le parent
    if (typeof justificationNote === 'string' && justificationNote.trim() !== '') {
      update['justification.note'] = justificationNote.trim()
      update['justification.status'] = 'PENDING'
      update['justification.submittedAt'] = new Date()
    }

    // Traitement / Validation par la Vie Scolaire (CPE)
    if (justificationAction === 'ACCEPT') {
      update.status = 'EXCUSED'
      update['justification.status'] = 'ACCEPTED'
      update['justification.validatedAt'] = new Date()
    } else if (justificationAction === 'REJECT') {
      update['justification.status'] = 'REJECTED'
      update['justification.validatedAt'] = new Date()
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Rien à mettre à jour' },
        { status: 400 }
      )
    }

    const updated = await AttendanceEntry.findByIdAndUpdate(entryId, update, { new: true }).lean()
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Entrée introuvable' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('❌ [API] PUT /api/attendance/[entryId]:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour du statut' },
      { status: 500 }
    )
  }
}

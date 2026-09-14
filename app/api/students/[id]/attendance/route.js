import { NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

const AttendanceEntry = require('../../../_/models/ai/AttendanceEntry')

/**
 * GET /api/students/{id}/attendance
 * Récapitulatif des présences d'un élève : compteurs par statut + historique récent
 * des absences/retards/justifiés (pour le dashboard élève/parent).
 */
export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request, 'GET /api/students/[id]/attendance')
    if (auth instanceof NextResponse) return auth

    await dbConnect()
    
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const schoolKey = cookieStore.get('x-school-key')?.value || 'ecole_st_martin';

    const { id } = await params
    const mongoose = require('mongoose')
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'id invalide' }, { status: 400 })
    }
    const studentId = new mongoose.Types.ObjectId(id)

    const agg = await AttendanceEntry.aggregate([
      { $match: { schoolKey, studentId } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ])

    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    for (const row of agg) summary[row._id] = row.n
    const total = summary.PRESENT + summary.ABSENT + summary.LATE + summary.EXCUSED

    // Derniers évènements notables (hors présences) pour affichage rapide
    const recent = await AttendanceEntry.find({
      schoolKey,
      studentId,
      status: { $in: ['ABSENT', 'LATE', 'EXCUSED'] },
    })
      .sort({ date: -1 })
      .limit(20)
      .select('status comment date justification')
      .lean()

    return NextResponse.json({
      success: true,
      data: { studentId: id, total, summary, recent },
    })
  } catch (error) {
    console.error('❌ [API] GET /api/students/[id]/attendance:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors du calcul des présences' },
      { status: 500 }
    )
  }
}

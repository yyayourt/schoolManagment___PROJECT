import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

const mongoose = require('mongoose')
const AttendanceRecord = require('../../../_/models/ai/AttendanceRecord')
const AttendanceEntry = require('../../../_/models/ai/AttendanceEntry')
const User = require('../../../_/models/ai/User')
import { resolveSchoolKey } from '../../../lib/schoolScope';

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']
const PERIODS = ['MATIN', 'APRES_MIDI']

/**
 * Résout la fiche Teacher liée au compte Clerk connecté.
 * Retourne un ObjectId ou null (admin sans fiche prof, mode sample, etc.).
 */
async function resolveTeacherId(clerkId) {
  if (!clerkId) return null
  try {
    const user = await User.findOne({ clerkId }).select('roleData.teacherRef').lean()
    return user?.roleData?.teacherRef || null
  } catch (_) {
    return null
  }
}

// Normalise une date (string 'YYYY-MM-DD' ou timestamp) à minuit UTC du jour.
function normalizeDay(input) {
  const d = input ? new Date(input) : new Date()
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * POST /api/classes/{classId}/attendance
 * Enregistre (ou ré-enregistre) une session d'appel complète.
 * Body : { date, period, entries: [{ studentId, status, comment }] }
 * Revalider une session existante (même classe + jour + période) la remplace.
 */
export async function POST(request, { params }) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/classes/[classId]/attendance')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const { id: classId } = await params
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ success: false, error: 'classId invalide' }, { status: 400 })
    }

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ success: false, error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }
    const body = await request.json()
    const { date, period, entries } = body || {}

    // --- Validation ---
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'entries doit être un tableau non vide' },
        { status: 400 }
      )
    }
    const day = normalizeDay(date)
    if (!day) {
      return NextResponse.json({ success: false, error: 'date invalide' }, { status: 400 })
    }
    const finalPeriod = PERIODS.includes(period) ? period : 'MATIN'

    // On ne garde que les entrées avec un studentId valide.
    const validEntries = entries.filter(
      (e) => e && e.studentId && mongoose.Types.ObjectId.isValid(e.studentId)
    )
    if (validEntries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucun élève valide dans entries' },
        { status: 400 }
      )
    }

    const teacherId = await resolveTeacherId(authResult.userId)

    // Upsert de la session : on garde le même _id si elle existait déjà.
    // classId/date/period viennent du filtre (appliqués automatiquement à l'insert),
    // inutile (et conflictuel) de les répéter dans un $setOnInsert.
    let record
    try {
      record = await AttendanceRecord.findOneAndUpdate(
        { classId, date: day, period: finalPeriod },
        { $set: { schoolKey, teacherId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
    } catch (err) {
      // Race sur l'index unique (deux POST simultanés) : la session existe désormais.
      if (err && err.code === 11000) {
        record = await AttendanceRecord.findOne({ classId, date: day, period: finalPeriod })
      } else throw err
    }

    // Upsert par élève (idempotent) : pas de fenêtre où la session serait vide,
    // contrairement à un deleteMany + insertMany non transactionnel.
    const studentIds = validEntries.map((e) => e.studentId)
    const ops = validEntries.map((e) => ({
      updateOne: {
        filter: { recordId: record._id, studentId: e.studentId },
        update: {
          $set: {
            schoolKey,
            status: STATUSES.includes(e.status) ? e.status : 'PRESENT',
            comment: typeof e.comment === 'string' ? e.comment.trim() : '',
            classId,
            date: day,
          },
        },
        upsert: true,
      },
    }))
    await AttendanceEntry.bulkWrite(ops, { ordered: false })
    // Retire les élèves qui ne sont plus dans la liste soumise (sortie de classe).
    await AttendanceEntry.deleteMany({ recordId: record._id, studentId: { $nin: studentIds } })

    // Résumé recalculé depuis la BDD (source de vérité)
    const fresh = await AttendanceEntry.find({ recordId: record._id }).select('status').lean()
    const summary = fresh.reduce(
      (acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1
        return acc
      },
      { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    )

    return NextResponse.json(
      {
        success: true,
        data: {
          record: { _id: record._id, classId, date: day, period: finalPeriod },
          count: fresh.length,
          summary,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('❌ [API] POST /api/classes/[classId]/attendance:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'enregistrement de l\'appel' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/classes/{classId}/attendance
 *   - ?date=YYYY-MM-DD&period=MATIN : renvoie la session de ce jour (record + entries)
 *     pour pré-remplir / modifier un appel.
 *   - sans `date` : renvoie l'historique des sessions (récapitulatif par session).
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authWithFallback(request, 'GET /api/classes/[classId]/attendance')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const schoolKey = await resolveSchoolKey();

    const { id: classId } = await params
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ success: false, error: 'classId invalide' }, { status: 400 })
    }
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    // --- Cas 1 : une session précise (pour édition) ---
    if (dateParam) {
      const day = normalizeDay(dateParam)
      if (!day) {
        return NextResponse.json({ success: false, error: 'date invalide' }, { status: 400 })
      }
      const period = PERIODS.includes(searchParams.get('period')) ? searchParams.get('period') : 'MATIN'
      const record = await AttendanceRecord.findOne({ schoolKey, classId, date: day, period }).lean()
      if (!record) {
        return NextResponse.json({ success: true, data: { record: null, entries: [] } })
      }
      const entries = await AttendanceEntry.find({ recordId: record._id })
        .select('studentId status comment')
        .lean()
      return NextResponse.json({ success: true, data: { record, entries } })
    }

    // --- Cas 2 : historique (récapitulatif par session) ---
    const limit = Math.min(parseInt(searchParams.get('limit'), 10) || 60, 200)
    const records = await AttendanceRecord.find({ schoolKey, classId })
      .sort({ date: -1 })
      .limit(limit)
      .lean()

    const recordIds = records.map((r) => r._id)
    const counts = await AttendanceEntry.aggregate([
      { $match: { recordId: { $in: recordIds } } },
      { $group: { _id: { recordId: '$recordId', status: '$status' }, n: { $sum: 1 } } },
    ])

    const byRecord = {}
    for (const c of counts) {
      const key = String(c._id.recordId)
      if (!byRecord[key]) byRecord[key] = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
      byRecord[key][c._id.status] = c.n
    }

    const data = records.map((r) => ({
      ...r,
      summary: byRecord[String(r._id)] || { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 },
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('❌ [API] GET /api/classes/[classId]/attendance:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des appels' },
      { status: 500 }
    )
  }
}

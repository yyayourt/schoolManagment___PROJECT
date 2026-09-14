import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

const mongoose = require('mongoose')
const HomeworkEntry = require('../../../_/models/ai/HomeworkEntry')
const HomeworkCompletion = require('../../../_/models/ai/HomeworkCompletion')
const User = require('../../../_/models/ai/User')
import { resolveSchoolKey } from '../../../lib/schoolScope';

/** Résout la fiche Teacher liée au compte Clerk connecté (ou null). */
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
 * POST /api/classes/{classId}/homework
 * Ajoute un devoir. Body : { subject, dateDue, content, attachments?, estimatedTime? }
 */
export async function POST(request, { params }) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/classes/[id]/homework')
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
    const { subject, dateDue, content, attachments, estimatedTime } = body || {}

    if (!subject || !String(subject).trim()) {
      return NextResponse.json({ success: false, error: 'La matière est requise' }, { status: 400 })
    }
    if (!content || !String(content).trim()) {
      return NextResponse.json({ success: false, error: 'Les consignes sont requises' }, { status: 400 })
    }
    const day = normalizeDay(dateDue)
    if (!day) {
      return NextResponse.json({ success: false, error: 'dateDue invalide' }, { status: 400 })
    }

    const teacherId = await resolveTeacherId(authResult.userId)
    const est = Number.isFinite(Number(estimatedTime)) && Number(estimatedTime) > 0
      ? Math.round(Number(estimatedTime))
      : null

    const created = await HomeworkEntry.create({
      schoolKey,
      classId,
      teacherId,
      subject: String(subject).trim(),
      dateDue: day,
      content: String(content).trim(),
      attachments: Array.isArray(attachments) ? attachments.filter((a) => typeof a === 'string') : [],
      estimatedTime: est,
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('❌ [API] POST /api/classes/[id]/homework:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'ajout du devoir' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/classes/{classId}/homework
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD : borne la période (défaut : à partir d'aujourd'hui)
 *   ?studentId=... : ajoute le statut « fait » de cet élève à chaque devoir
 * Renvoie une liste plate triée par dateDue (le client regroupe par jour).
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authWithFallback(request, 'GET /api/classes/[id]/homework')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const { id: classId } = await params
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ success: false, error: 'classId invalide' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const fromDay = normalizeDay(searchParams.get('from')) || normalizeDay()
    const toParam = searchParams.get('to')

    const filter = { classId, dateDue: { $gte: fromDay } }
    if (toParam) {
      const toDay = normalizeDay(toParam)
      if (toDay) filter.dateDue.$lte = toDay
    }

    const homework = await HomeworkEntry.find(filter).sort({ dateDue: 1, subject: 1 }).lean()

    // Statut de complétion pour un élève donné
    const studentId = searchParams.get('studentId')
    if (studentId && mongoose.Types.ObjectId.isValid(studentId) && homework.length) {
      const ids = homework.map((h) => h._id)
      const done = await HomeworkCompletion.find({
        studentId,
        homeworkId: { $in: ids },
        status: 'DONE',
      }).select('homeworkId').lean()
      const doneSet = new Set(done.map((d) => String(d.homeworkId)))
      for (const h of homework) h.done = doneSet.has(String(h._id))
    }

    return NextResponse.json({ success: true, data: homework })
  } catch (error) {
    console.error('❌ [API] GET /api/classes/[id]/homework:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des devoirs' },
      { status: 500 }
    )
  }
}

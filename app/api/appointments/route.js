import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../lib/authWithFallback'
import dbConnect from '../lib/dbConnect'

const mongoose = require('mongoose')
const Appointment = require('../_/models/ai/Appointment')
const User = require('../_/models/ai/User')
import { resolveSchoolKey } from '../lib/schoolScope';
require('../_/models/ai/Eleve')
require('../_/models/ai/Teacher')

const FORMATS = ['PRESENTIAL', 'VISIO']

// Normalise un tableau de créneaux {startDate,endDate} (ISO) en dates valides.
function parseRanges(arr) {
  if (!Array.isArray(arr)) return null
  const ranges = []
  for (const r of arr) {
    const start = new Date(r?.startDate)
    const end = new Date(r?.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    if (end < start) return null
    ranges.push({ startDate: start, endDate: end })
  }
  return ranges
}

/**
 * GET /api/appointments
 * Liste les rendez-vous où le demandeur est initiateur OU destinataire.
 * Query optionnelle : studentId, status, direction ('sent'|'received').
 */
export async function GET(request) {
  try {
    const authResult = await authWithFallback(request, 'GET /api/appointments')
    if (!authResult.success) return authResult.response
    const me = authResult.userId

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const status = searchParams.get('status')
    const direction = searchParams.get('direction')

    const schoolKey = await resolveSchoolKey()

    let filter
    if (direction === 'sent') filter = { schoolKey, initiatorId: me }
    else if (direction === 'received') filter = { schoolKey, recipientId: me }
    else filter = { schoolKey, $or: [{ initiatorId: me }, { recipientId: me }] }

    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.studentId = studentId
    if (status) filter.meetingStatus = status

    const appointments = await Appointment.find(filter)
      .sort({ updatedAt: -1 })
      .populate('studentId', 'nom prenoms')
      .populate('teacherRef', 'nom prenoms')
      .lean()

    // Indique au client son rôle dans chaque RDV (initiateur ou destinataire).
    const data = appointments.map((a) => ({
      ...a,
      iAmInitiator: a.initiatorId === me,
      iAmRecipient: a.recipientId === me,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('❌ [API] GET /api/appointments:', error)
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement des rendez-vous' }, { status: 500 })
  }
}

/**
 * POST /api/appointments
 * Crée une demande (meetingStatus = PENDING).
 * Body : { initiatorRole, studentId, teacherRef?, title, statusLabel,
 *          proposedDates:[{startDate,endDate}], meetingFormatOptions:[...], message }
 *
 * Le destinataire (recipientId, clerkId) est résolu côté serveur :
 *   - parent → prof : recipient = User lié à teacherRef.
 *   - prof → parent : recipient = parent lié à l'élève (childrenRefs) ; teacherRef
 *     = le prof initiateur (sa propre roleData.teacherRef).
 */
export async function POST(request) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/appointments')
    if (!authResult.success) return authResult.response
    const me = authResult.userId

    await dbConnect()

    const body = await request.json()
    const { initiatorRole, studentId, teacherRef, title, statusLabel, proposedDates, meetingFormatOptions, message } = body || {}

    if (!['parent', 'prof'].includes(initiatorRole)) {
      return NextResponse.json({ success: false, error: 'initiatorRole invalide' }, { status: 400 })
    }
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json({ success: false, error: 'studentId invalide' }, { status: 400 })
    }
    const ranges = parseRanges(proposedDates)
    if (!ranges || ranges.length === 0) {
      return NextResponse.json({ success: false, error: 'Au moins une date proposée valide est requise' }, { status: 400 })
    }
    const formats = Array.isArray(meetingFormatOptions)
      ? meetingFormatOptions.filter((f) => FORMATS.includes(f))
      : []
    if (formats.length === 0) {
      return NextResponse.json({ success: false, error: 'Au moins un format (présentiel/visio) est requis' }, { status: 400 })
    }

    // Résolution du destinataire + du prof concerné.
    let recipientId
    let resolvedTeacherRef = null
    if (initiatorRole === 'parent') {
      if (!teacherRef || !mongoose.Types.ObjectId.isValid(teacherRef)) {
        return NextResponse.json({ success: false, error: 'teacherRef invalide' }, { status: 400 })
      }
      const teacherUser = await User.findOne({ 'roleData.teacherRef': teacherRef })
      if (!teacherUser) {
        return NextResponse.json({ success: false, error: "Ce professeur n'a pas encore de compte." }, { status: 409 })
      }
      recipientId = teacherUser.clerkId
      resolvedTeacherRef = teacherRef
    } else {
      // prof → parent : destinataire = un parent lié à l'élève
      const parentUser = await User.findOne({ role: 'parent', 'roleData.childrenRefs': studentId })
      if (!parentUser) {
        return NextResponse.json({ success: false, error: "Aucun parent avec un compte n'est rattaché à cet élève." }, { status: 409 })
      }
      recipientId = parentUser.clerkId
      // teacherRef = le prof initiateur lui-même
      const meUser = await User.findOne({ clerkId: me })
      resolvedTeacherRef = meUser?.roleData?.teacherRef || (mongoose.Types.ObjectId.isValid(teacherRef) ? teacherRef : null)
    }

    if (recipientId === me) {
      return NextResponse.json({ success: false, error: 'Initiateur et destinataire identiques' }, { status: 400 })
    }

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ success: false, error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    const appointment = await Appointment.create({
      schoolKey,
      initiatorId: me,
      initiatorRole,
      recipientId,
      studentId,
      teacherRef: resolvedTeacherRef,
      title: typeof title === 'string' ? title.trim() : '',
      statusLabel: typeof statusLabel === 'string' && statusLabel.trim() ? statusLabel.trim() : 'Demande de rdv',
      meetingStatus: 'PENDING',
      proposedDates: ranges,
      meetingFormatOptions: formats,
      message: typeof message === 'string' ? message.trim() : '',
    })

    await appointment.populate([
      { path: 'studentId', select: 'nom prenoms' },
      { path: 'teacherRef', select: 'nom prenoms' },
    ])

    return NextResponse.json({ success: true, data: appointment }, { status: 201 })
  } catch (error) {
    console.error('❌ [API] POST /api/appointments:', error)
    return NextResponse.json({ success: false, error: 'Erreur lors de la création du rendez-vous' }, { status: 500 })
  }
}

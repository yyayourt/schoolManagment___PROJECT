import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../lib/authWithFallback'
import dbConnect from '../lib/dbConnect'

const mongoose = require('mongoose')
const EventModel = require('../_/models/ai/Event')
import { resolveSchoolKey } from '../lib/schoolScope';

const TYPES = ['SORTIE', 'EVALUATION', 'REUNION', 'FERMETURE', 'AUTRE']

/**
 * GET /api/events
 * Liste les événements visibles. Query :
 *   - classId : inclut les événements de cette classe EN PLUS des événements globaux
 *   - from / to : bornes ISO ; on retourne les événements qui chevauchent l'intervalle
 * Sans from/to : événements à venir (endDate >= aujourd'hui).
 */
export async function GET(request) {
  try {
    const authResult = await authWithFallback(request, 'GET /api/events')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const teacherId = searchParams.get('teacherId')

    // Portée : toujours les événements globaux, + ceux de la classe demandée.
    const scope = [{ isGlobal: true }]
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      scope.push({ classId })
    } else if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
      // Résoudre les classes du prof
      const Teacher = require('../_/models/ai/Teacher')
      const teacher = await Teacher.findById(teacherId)
      if (teacher && Array.isArray(teacher.current_classes) && teacher.current_classes.length > 0) {
        scope.push({ classId: { $in: teacher.current_classes } })
      }
    }

    const schoolKey = await resolveSchoolKey()

    const filter = { schoolKey, $or: scope }

    if (from || to) {
      // Chevauchement avec [from, to] : endDate >= from ET startDate <= to.
      const range = {}
      if (from) range.endDate = { $gte: new Date(from) }
      if (to) range.startDate = { $lte: new Date(to) }
      Object.assign(filter, range)
    } else {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      filter.endDate = { $gte: startOfToday }
    }

    const events = await EventModel.find(filter).sort({ startDate: 1 }).lean()
    return NextResponse.json({ success: true, data: events })
  } catch (error) {
    console.error('❌ [API] GET /api/events:', error)
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement des événements' }, { status: 500 })
  }
}

/**
 * POST /api/events
 * Crée un événement. Body : { title, type, startDate, endDate, isGlobal, classId?, location?, description?, notifyParents? }
 */
export async function POST(request) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/events')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const body = await request.json()
    const { title, type, startDate, endDate, isGlobal, classId, location, description, notifyParents, hasVisio } = body || {}

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ success: false, error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    if (!title || !String(title).trim()) {
      return NextResponse.json({ success: false, error: 'Le titre est requis' }, { status: 400 })
    }
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ success: false, error: 'Dates invalides' }, { status: 400 })
    }
    if (end < start) {
      return NextResponse.json({ success: false, error: 'La date de fin doit suivre la date de début' }, { status: 400 })
    }
    const global = Boolean(isGlobal)
    if (!global && (!classId || !mongoose.Types.ObjectId.isValid(classId))) {
      return NextResponse.json({ success: false, error: 'Un événement de classe requiert un classId valide' }, { status: 400 })
    }

    const event = await EventModel.create({
      schoolKey,
      title: String(title).trim(),
      description: typeof description === 'string' ? description.trim() : '',
      startDate: start,
      endDate: end,
      isGlobal: global,
      classId: global ? null : classId,
      location: typeof location === 'string' ? location.trim() : '',
      type: TYPES.includes(type) ? type : 'AUTRE',
      notifyParents: Boolean(notifyParents),
      hasVisio: Boolean(hasVisio),
      createdBy: authResult.userId || null,
    })

    // Salon Jitsi cryptique et stable, dérivé de l'_id (généré une fois la pièce créée).
    if (event.hasVisio && !event.visioRoomName) {
      event.visioRoomName = `ecole-event-${event._id}`
      await event.save()
    }

    return NextResponse.json({ success: true, data: event }, { status: 201 })
  } catch (error) {
    console.error('❌ [API] POST /api/events:', error)
    return NextResponse.json({ success: false, error: 'Erreur lors de la création de l\'événement' }, { status: 500 })
  }
}

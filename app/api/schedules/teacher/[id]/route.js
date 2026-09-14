import { NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

// Import models
const mongoose = require('mongoose')
const Schedule = require('../../../_/models/ai/Schedule')
const Teacher = require('../../../_/models/ai/Teacher')
const Classe = require('../../../_/models/ai/Classe')
const User = require('../../../_/models/ai/User')
const Subject = require('../../../_/models/ai/Subject')
import { resolveSchoolKey } from '../../../lib/schoolScope';

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth(request, 'GET /api/schedules/teacher/[id]')
    if (authResult instanceof NextResponse) {
      return authResult
    }

    await dbConnect()
    const schoolKey = await resolveSchoolKey();

    const { id } = await params

    // 1. Resolve Teacher
    let teacher = null
    let teacherMongoId = null
    let teacherClerkId = null

    if (mongoose.Types.ObjectId.isValid(id)) {
      teacher = await Teacher.findById(id)
    }
    
    if (!teacher) {
      // Try resolving by clerk ID
      const user = await User.findOne({ clerkId: id })
      if (user && user.role === 'prof' && user.roleData?.teacherRef) {
        teacher = await Teacher.findById(user.roleData.teacherRef)
        teacherClerkId = id
      } else {
        // Fallback: search Teacher by clerkId if it exists somewhere or user is not fully synced
        teacherClerkId = id
      }
    }

    if (teacher) {
      teacherMongoId = teacher._id.toString()
    } else if (!teacherClerkId) {
      return NextResponse.json({ error: 'Professeur non trouvé' }, { status: 404 })
    }

    // 2. Fetch all active schedules across the school
    const activeSchedules = await Schedule.find({ schoolKey, isArchived: false })
      .populate('classeId')
      .populate('events.subjectId')
      .lean()

    // 3. Filter events relevant to this teacher
    let teacherEvents = []
    
    // Pour calculer les bornes minimales et maximales
    let earliestStart = "23:59"
    let latestEnd = "00:00"

    for (const schedule of activeSchedules) {
      const classe = schedule.classeId
      if (!classe) continue
      
      const classeProfs = Array.isArray(classe.professeur) ? classe.professeur.map(p => p.toString()) : []
      const isTeacherInClasse = teacherMongoId && classeProfs.includes(teacherMongoId)
      // S'il n'y a qu'un seul prof pour cette classe et c'est notre prof, on peut auto-assigner
      const isSoleTeacher = isTeacherInClasse && classeProfs.length === 1

      for (const event of schedule.events) {
        let isMyEvent = false

        if (event.teacherId) {
          // Assignation explicite
          if (teacherMongoId && event.teacherId === teacherMongoId) isMyEvent = true
          if (teacherClerkId && event.teacherId === teacherClerkId) isMyEvent = true
        } else if (isSoleTeacher && event.type === 'COURSE') {
          // Assignation implicite (déduite)
          isMyEvent = true
        }

        if (isMyEvent) {
          // Formatage du subject virtuel pour afficher la classe
          let formattedSubject = event.subjectId
          if (event.type === 'COURSE' && event.subjectId) {
            formattedSubject = {
              _id: event.subjectId._id,
              nom: `${event.subjectId.nom} (${classe.niveau} ${classe.alias})`,
              couleur: event.subjectId.couleur
            }
          }

          teacherEvents.push({
            ...event,
            subjectId: formattedSubject,
            _originalScheduleId: schedule._id,
            _classeId: classe._id,
            _classeLabel: `${classe.niveau} ${classe.alias}`
          })
          
          if (event.startTime < earliestStart) earliestStart = event.startTime
          if (event.endTime > latestEnd) latestEnd = event.endTime
        }
      }
    }

    // 4. Create the virtual schedule object
    const virtualSchedule = {
      _id: `virtual-teacher-${id}`,
      label: teacher ? `Emploi du temps - ${teacher.prenoms?.join(' ') || ''} ${teacher.nom}` : "Emploi du temps personnel",
      events: teacherEvents,
      validFrom: new Date(),
      validUntil: null,
      isArchived: false,
      mediaSourceUrls: [],
      // Méta données pour la grille
      earliestStart: earliestStart === "23:59" ? "08:00" : earliestStart,
      latestEnd: latestEnd === "00:00" ? "18:00" : latestEnd
    }

    return NextResponse.json({
      success: true,
      data: [virtualSchedule] // Retourne un array pour compatibilité avec le frontend qui s'attend à [0]
    })

  } catch (error) {
    console.error('Erreur GET /api/schedules/teacher/[id]:', error)
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
  }
}

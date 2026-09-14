import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../../../../lib/authWithFallback'
import dbConnect from '../../../../lib/dbConnect'
import { computeClassReport, computeClassReportFromNotes, mention, periodToIndices } from '../../../../../../utils/bulletins'

const mongoose = require('mongoose')
const Eleve = require('../../../../_/models/ai/Eleve')
const Classe = require('../../../../_/models/ai/Classe')
const Subject = require('../../../../_/models/ai/Subject')
const ReportCard = require('../../../../_/models/ai/ReportCard')
const User = require('../../../../_/models/ai/User')
const Note = require('../../../../_/models/ai/Note')

const PERIODS = ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'ANNUEL']

async function resolveTeacherId(clerkId) {
  if (!clerkId) return null
  try {
    const user = await User.findOne({ clerkId }).select('roleData.teacherRef').lean()
    return user?.roleData?.teacherRef || null
  } catch (_) {
    return null
  }
}

const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100)

/**
 * POST /api/classes/{classId}/report-cards/generate
 * Calcule les moyennes (élève + comparatifs classe) et fige un bulletin par élève.
 * Body : { schoolYear, period, appreciations?: { [studentId]: { general?, subjects?: {key:txt} } } }
 */
export async function POST(request, { params }) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/classes/[id]/report-cards/generate')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const { id: classId } = await params
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json({ success: false, error: 'classId invalide' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const schoolKey = cookieStore.get('x-school-key')?.value
    if (!schoolKey) {
      return NextResponse.json({ success: false, error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    const body = await request.json()
    const { schoolYear, period, appreciations } = body || {}
    if (!schoolYear || typeof schoolYear !== 'string') {
      return NextResponse.json({ success: false, error: 'schoolYear est requis' }, { status: 400 })
    }
    if (!PERIODS.includes(period)) {
      return NextResponse.json({ success: false, error: 'period invalide' }, { status: 400 })
    }
    const apprec = appreciations && typeof appreciations === 'object' ? appreciations : {}

    const eleves = await Eleve.find({ schoolKey, current_classe: classId }).lean()
    if (eleves.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun élève dans cette classe' }, { status: 404 })
    }

    // Récupérer la classe pour lire ses coefficients (configurés par le PP / Admin)
    const classe = await Classe.findById(classId).lean()
    const classCoefficients = classe?.coefficients || {}

    // Recherche des notes du trimestre pour la classe
    const trimestres = periodToIndices(period).map(i => i + 1) // [0] -> [1] (Trimestre 1)
    const notes = await Note.find({ 
      schoolKey, 
      classeId: classId, 
      annee: schoolYear, 
      trimestre: { $in: trimestres } 
    }).lean()

    // Calcul autoritaire côté serveur (Priorité au nouveau système de notes)
    let report;
    if (notes && notes.length > 0) {
      report = computeClassReportFromNotes(eleves, notes, classCoefficients)
    } else {
      // Solution de repli (Rétrocompatibilité Primaire ou si aucune nouvelle note n'a été saisie)
      report = computeClassReport(eleves, schoolYear, period)
    }

    // Résolution des noms de matières (les clés peuvent être des ObjectId)
    const subjects = await Subject.find({ schoolKey }).select('nom').lean()
    const subjMap = new Map(subjects.map((s) => [String(s._id), s.nom]))
    const nameOf = (key, fallbackName) =>
      fallbackName || subjMap.get(String(key)) || String(key)

    const teacherId = await resolveTeacherId(authResult.userId)

    const ops = report.perStudent.map((ps) => {
      const a = apprec[ps.studentId] || {}
      const subjAppr = (a.subjects && typeof a.subjects === 'object') ? a.subjects : {}
      const general = round2(ps.general)
      // Mention calculée sur la moyenne arrondie affichée (cohérence à la limite, ex. 15.996→16.00).
      const subjectsLines = ps.subjects.map((s) => {
        const cls = report.classSubjects[s.key] || {}
        return {
          key: s.key,
          name: nameOf(s.key, s.name),
          average: round2(s.average),
          classAverage: round2(cls.average),
          classMin: round2(cls.min),
          classMax: round2(cls.max),
          appreciation: typeof subjAppr[s.key] === 'string' ? subjAppr[s.key].trim() : '',
        }
      })

      return {
        updateOne: {
          filter: { studentId: ps.studentId, schoolYear, period },
          update: {
            $set: {
              schoolKey,
              classId,
              globalAverage: general,
              classGeneralAverage: round2(report.classGeneral),
              rank: report.rank[ps.studentId] || null,
              classSize: report.classSize,
              mention: mention(general),
              source: ps.source,
              subjects: subjectsLines,
              generalAppreciation: typeof a.general === 'string' ? a.general.trim() : '',
              isClassSummary: false,
              generatedBy: teacherId,
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      }
    })

    await ReportCard.bulkWrite(ops, { ordered: false })

    const cards = await ReportCard.find({ schoolKey, classId, schoolYear, period }).lean()
    return NextResponse.json({ success: true, data: { count: cards.length, cards } }, { status: 201 })
  } catch (error) {
    console.error('❌ [API] POST /api/classes/[id]/report-cards/generate:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la génération des bulletins' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../../lib/authWithFallback'
import dbConnect from '../../lib/dbConnect'

const PointLabel = require('../../_/models/ai/PointLabel')
const PointTransaction = require('../../_/models/ai/PointTransaction')
const Eleve = require('../../_/models/ai/Eleve')
const User = require('../../_/models/ai/User')
import { resolveSchoolKey } from '../../lib/schoolScope';

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

/**
 * POST /api/points/award
 * Attribue (ou retire) des points à un ou plusieurs élèves.
 * Body : { studentIds: string[], labelId: string, amount?: number, comment?: string }
 *   - amount optionnel : surcharge le montant. Sinon dérivé du label
 *     (positif pour un BONUS, négatif pour un MALUS).
 */
export async function POST(request) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/points/award')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const body = await request.json()
    const { studentIds, labelId, amount, comment } = body || {}

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ success: false, error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    // --- Validation ---
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'studentIds doit être un tableau non vide' },
        { status: 400 }
      )
    }
    if (!labelId) {
      return NextResponse.json({ success: false, error: 'labelId est requis' }, { status: 400 })
    }
    if (amount !== undefined && !Number.isInteger(amount)) {
      return NextResponse.json(
        { success: false, error: 'amount, si fourni, doit être un entier' },
        { status: 400 }
      )
    }

    const label = await PointLabel.findById(labelId).lean()
    if (!label) {
      return NextResponse.json({ success: false, error: 'Catégorie (labelId) introuvable' }, { status: 404 })
    }

    // Montant final : surcharge fournie, sinon dérivé du label selon son type
    const base = Number.isInteger(amount) ? amount : (label.defaultAmount ?? 1)
    const finalAmount = amount !== undefined
      ? amount
      : (label.type === 'MALUS' ? -Math.abs(base) : Math.abs(base))

    if (finalAmount === 0) {
      return NextResponse.json({ success: false, error: 'Le montant ne peut pas être nul' }, { status: 400 })
    }

    // Récupérer les élèves existants (pour valider + résoudre leur classe)
    const students = await Eleve.find({ _id: { $in: studentIds } }).select('current_classe').lean()
    if (students.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun élève valide trouvé' }, { status: 404 })
    }

    const teacherId = await resolveTeacherId(authResult.userId)
    const cleanComment = typeof comment === 'string' ? comment.trim() : ''

    const docs = students.map((s) => ({
      schoolKey,
      studentId: s._id,
      teacherId,
      classId: s.current_classe || null,
      amount: finalAmount,
      labelId: label._id,
      comment: cleanComment,
    }))

    const created = await PointTransaction.insertMany(docs)

    // Élèves demandés mais introuvables (signalés sans bloquer l'opération)
    const foundIds = new Set(students.map((s) => s._id.toString()))
    const notFound = studentIds.filter((id) => !foundIds.has(String(id)))

    return NextResponse.json(
      {
        success: true,
        data: {
          awardedCount: created.length,
          amount: finalAmount,
          label: { _id: label._id, name: label.name, type: label.type },
          transactions: created,
          notFound,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('❌ [API] POST /api/points/award:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'attribution des points' },
      { status: 500 }
    )
  }
}

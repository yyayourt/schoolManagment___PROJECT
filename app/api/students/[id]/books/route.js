import { NextResponse } from 'next/server'
import { requireAuth } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

const StudentBook = require('../../../_/models/ai/StudentBook')
const ClassBook = require('../../../_/models/ai/ClassBook')
const Classe = require('../../../_/models/ai/Classe')
import { resolveSchoolKey } from '../../../lib/schoolScope';

/**
 * GET /api/students/[id]/books
 * Récupère l'historique de tous les livres de classe (StudentBook) d'un élève.
 */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const userId = await requireAuth(request, `GET /api/students/${id}/books`)
    if (userId instanceof NextResponse) return userId

    await dbConnect()

    const schoolKey = await resolveSchoolKey();

    const studentBooks = await StudentBook.find({ schoolKey, studentId: id })
      .populate({
        path: 'classBookId',
        populate: {
          path: 'classId',
          select: 'niveau alias'
        }
      })
      .sort({ createdAt: -1 })

    return NextResponse.json({
      success: true,
      data: studentBooks
    })

  } catch (error) {
    console.error('Erreur GET /api/students/[id]/books:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la récupération des albums de l\'élève' },
      { status: 500 }
    )
  }
}

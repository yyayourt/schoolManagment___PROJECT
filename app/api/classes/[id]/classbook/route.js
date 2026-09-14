import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

const Classe = require('../../../_/models/ai/Classe')
const ClassBook = require('../../../_/models/ai/ClassBook')
const User = require('../../../_/models/ai/User')
import { resolveSchoolKey } from '../../../lib/schoolScope';

/**
 * GET /api/classes/[id]/classbook
 * Récupère ou initialise le document ClassBook pour la classe et l'année en cours.
 */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const userId = await requireAuth(request, `GET /api/classes/${id}/classbook`)
    if (userId instanceof NextResponse) return userId

    await dbConnect()

    const classe = await Classe.findById(id)
    if (!classe) {
      return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 })
    }

    const schoolYear = classe.annee || '2025-2026'

    // Chercher le livre de classe existant
    let classBook = await ClassBook.findOne({ classId: id, schoolYear })

    // S'il n'existe pas, l'initialiser
    if (!classBook) {
      const schoolKey = await resolveSchoolKey()

      const title = `Livre de Classe - ${classe.niveau} ${classe.alias} (${schoolYear})`
      classBook = new ClassBook({
        schoolKey,
        classId: id,
        schoolYear,
        title,
        coverImage: classe.photo || '',
        status: 'DRAFT',
        globalPdfUrl: ''
      })
      await classBook.save()
    }

    return NextResponse.json({
      success: true,
      data: classBook
    })

  } catch (error) {
    console.error('Erreur GET /api/classes/[id]/classbook:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors du chargement du livre de classe' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/classes/[id]/classbook
 * Met à jour les métadonnées (titre, statut de publication, couverture, URL du PDF).
 */
export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const userId = await requireAuth(request, `PUT /api/classes/${id}/classbook`)
    if (userId instanceof NextResponse) return userId

    await dbConnect()

    // Vérifier les permissions
    const currentUserDoc = await User.findOne({ clerkId: userId })
    const isAdmin = currentUserDoc?.role === 'admin'
    const isTeacher = currentUserDoc?.role === 'prof'

    if (!isAdmin && !isTeacher) {
      return NextResponse.json({ error: 'Non autorisé à modifier le livre de classe' }, { status: 403 })
    }

    const classe = await Classe.findById(id)
    if (!classe) {
      return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 })
    }

    const schoolYear = classe.annee || '2025-2026'
    const body = await request.json()
    const { title, coverImage, status, globalPdfUrl } = body

    // Chercher et mettre à jour le livre
    let classBook = await ClassBook.findOne({ classId: id, schoolYear })
    if (!classBook) {
      const schoolKey = await resolveSchoolKey()

      classBook = new ClassBook({
        schoolKey,
        classId: id,
        schoolYear,
        title: title || `Livre de Classe - ${classe.niveau} ${classe.alias} (${schoolYear})`,
        coverImage: coverImage || '',
        status: status || 'DRAFT',
        globalPdfUrl: globalPdfUrl || ''
      })
    } else {
      if (title !== undefined) classBook.title = title
      if (coverImage !== undefined) classBook.coverImage = coverImage
      if (status !== undefined) classBook.status = status
      if (globalPdfUrl !== undefined) classBook.globalPdfUrl = globalPdfUrl
    }

    const savedBook = await classBook.save()

    return NextResponse.json({
      success: true,
      data: savedBook
    })

  } catch (error) {
    console.error('Erreur PUT /api/classes/[id]/classbook:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la mise à jour du livre de classe' },
      { status: 500 }
    )
  }
}

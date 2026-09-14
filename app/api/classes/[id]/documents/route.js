import { NextResponse } from 'next/server'
import { authWithFallback } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'
import cloudinaryService from '../../../../../services/cloudinaryService'
import { checkRole, Roles } from '../../../../../utils/roles'

const ClassDocument = require('../../../_/models/ai/ClassDocument')
const Classe = require('../../../_/models/ai/Classe')
const User = require('../../../_/models/ai/User')
import { resolveSchoolKey } from '../../../lib/schoolScope';

// Taille maximale acceptée pour un document (15 Mo).
const MAX_FILE_SIZE = 15 * 1024 * 1024

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
 * GET /api/classes/{id}/documents
 * Récupère la liste des documents de cours d'une classe (le plus récent d'abord).
 * Accessible à tout utilisateur authentifié (prof, élève, parent).
 */
export async function GET(request, { params }) {
  try {
    const auth = await authWithFallback(request, 'GET /api/classes/[id]/documents')
    if (!auth.success) return auth.response

    await dbConnect()

    const schoolKey = await resolveSchoolKey();

    const { id } = await params

    const documents = await ClassDocument.find({ schoolKey, classId: id })
      .populate('teacherId', 'nom prenoms')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ success: true, data: documents })
  } catch (error) {
    console.error('❌ [API] GET /api/classes/[id]/documents:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des documents' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/classes/{id}/documents
 * Dépose un nouveau document de cours (Option A : le backend agit comme proxy).
 * Le client envoie un `multipart/form-data` : { file, title }.
 * Le backend envoie le fichier sur Cloudinary puis enregistre l'entrée en BDD.
 * Réservé aux professeurs et administrateurs.
 */
export async function POST(request, { params }) {
  try {
    const auth = await authWithFallback(request, 'POST /api/classes/[id]/documents')
    if (!auth.success) return auth.response

    const isAdmin = await checkRole(Roles.ADMIN, request)
    const isTeacher = await checkRole(Roles.TEACHER, request)
    if (!isAdmin && !isTeacher) {
      return NextResponse.json(
        { success: false, error: 'Accès refusé — réservé aux professeurs et administrateurs' },
        { status: 403 }
      )
    }

    await dbConnect()

    const { id } = await params

    // Vérifier que la classe existe
    const classe = await Classe.findById(id).select('_id').lean()
    if (!classe) {
      return NextResponse.json({ success: false, error: 'Classe introuvable' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const rawTitle = formData.get('title')

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ success: false, error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
    if (!title) {
      return NextResponse.json({ success: false, error: 'Le titre du document est requis' }, { status: 400 })
    }

    // Validation du type (PDF uniquement pour cette spécification)
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
    if (!isPdf) {
      return NextResponse.json(
        { success: false, error: 'Seuls les fichiers PDF sont acceptés' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Le fichier est trop volumineux (max 15 Mo)' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload vers Cloudinary (resource_type 'raw' : pas de transformation, livraison directe du PDF)
    cloudinaryService.init()
    if (!cloudinaryService.cloudinary) {
      return NextResponse.json(
        { success: false, error: 'Service de stockage indisponible' },
        { status: 503 }
      )
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinaryService.cloudinary.uploader.upload_stream(
        {
          folder: `school/classes/${id}/documents`,
          resource_type: 'raw',
          tags: ['class-document', String(id)],
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      )
      stream.end(buffer)
    })

    const teacherId = await resolveTeacherId(auth.userId)

    const doc = await ClassDocument.create({
      classId: id,
      teacherId,
      title,
      fileUrl: uploadResult.secure_url,
      cloudinaryPublicId: uploadResult.public_id,
      cloudinaryResourceType: uploadResult.resource_type || 'raw',
      fileSize: file.size,
    })

    // Re-peupler le prof pour un affichage immédiat côté client
    const populated = await ClassDocument.findById(doc._id)
      .populate('teacherId', 'nom prenoms')
      .lean()

    return NextResponse.json({ success: true, data: populated }, { status: 201 })
  } catch (error) {
    console.error('❌ [API] POST /api/classes/[id]/documents:', error)
    return NextResponse.json(
      { success: false, error: "Erreur lors du dépôt du document" },
      { status: 500 }
    )
  }
}

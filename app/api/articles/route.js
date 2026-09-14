import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../lib/authWithFallback'
import dbConnect from '../lib/dbConnect'

const User = require('../_/models/ai/User')
const Article = require('../_/models/ai/Article')
import { resolveSchoolKey } from '../lib/schoolScope';

const WRITER_ROLES = ['admin', 'prof', 'eleve', 'parent']

function isStaffRole(role) {
  return role === 'admin' || role === 'prof'
}

// Échappe les métacaractères regex pour une recherche texte sûre.
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * GET /api/articles
 * Query :
 *   - view : 'published' (défaut, public) | 'mine' (mes articles) | 'pending' (file
 *            de modération, staff uniquement)
 *   - tag, role (authorRole), q (recherche dans le titre)
 */
export async function GET(request) {
  try {
    const authResult = await authWithFallback(request, 'GET /api/articles')
    if (!authResult.success) return authResult.response
    const me = authResult.userId

    await dbConnect()

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'published'
    const tag = searchParams.get('tag')
    const role = searchParams.get('role')
    const q = searchParams.get('q')

    const schoolKey = await resolveSchoolKey()

    const filter = { schoolKey }
    let sort = { publishedAt: -1 }

    if (view === 'mine') {
      filter.authorId = me
      sort = { updatedAt: -1 }
    } else if (view === 'pending') {
      const user = await User.findOne({ clerkId: me })
      if (!isStaffRole(user?.role)) {
        return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
      }
      filter.status = 'PENDING_REVIEW'
      sort = { updatedAt: -1 }
    } else {
      filter.status = 'PUBLISHED'
    }

    if (tag) filter.tags = tag
    if (role && WRITER_ROLES.includes(role)) filter.authorRole = role
    if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' }

    const articles = await Article.find(filter).sort(sort).lean()
    return NextResponse.json({ success: true, data: articles })
  } catch (error) {
    console.error('❌ [API] GET /api/articles:', error)
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement des articles' }, { status: 500 })
  }
}

/**
 * POST /api/articles
 * Crée un article. Body : { title, content, coverImage, tags, action: 'draft'|'submit'|'publish' }
 * Staff (prof/admin) peut publier directement ; élèves/parents passent en PENDING_REVIEW.
 */
export async function POST(request) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/articles')
    if (!authResult.success) return authResult.response
    const me = authResult.userId

    await dbConnect()

    const user = await User.findOne({ clerkId: me })
    const role = user?.role
    if (!WRITER_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: 'Votre rôle ne permet pas de rédiger un article.' }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, coverImage, tags, action } = body || {}
    if (!title || !String(title).trim()) {
      return NextResponse.json({ success: false, error: 'Le titre est requis' }, { status: 400 })
    }

    const staff = isStaffRole(role)
    let status = 'DRAFT'
    let publishedAt = null
    if (action === 'publish' && staff) {
      status = 'PUBLISHED'
      publishedAt = new Date()
    } else if (action === 'submit' || (action === 'publish' && !staff)) {
      status = 'PENDING_REVIEW'
    }

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ success: false, error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    const article = await Article.create({
      schoolKey,
      title: String(title).trim(),
      content: typeof content === 'string' ? content : '',
      coverImage: typeof coverImage === 'string' ? coverImage : '',
      authorId: me,
      authorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonyme',
      authorRole: role,
      status,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
      publishedAt,
    })

    return NextResponse.json({ success: true, data: article }, { status: 201 })
  } catch (error) {
    console.error('❌ [API] POST /api/articles:', error)
    return NextResponse.json({ success: false, error: "Erreur lors de la création de l'article" }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '../../lib/authWithFallback'
import dbConnect from '../../lib/dbConnect'

const Post = require('../../_/models/ai/Post')
const User = require('../../_/models/ai/User')
import { resolveSchoolKey } from '../../lib/schoolScope';

/**
 * GET /api/global/feed
 * Récupère tous les posts globaux de l'école (page d'accueil).
 */
export async function GET(request) {
  try {
    const userId = await requireAuth(request, 'GET /api/global/feed')
    if (userId instanceof NextResponse) return userId

    await dbConnect()

    const schoolKey = await resolveSchoolKey()

    const posts = await Post.find({ schoolKey, isGlobal: true }).sort({ createdAt: -1 })

    // Recueillir tous les Clerk IDs des votants de tous les posts de type POLL de cette page
    const voterClerkIds = new Set()
    posts.forEach(post => {
      if (post.type === 'POLL' && post.pollOptions) {
        post.pollOptions.forEach(opt => {
          if (opt.voters) {
            opt.voters.forEach(vid => voterClerkIds.add(vid))
          }
        })
      }
    })

    let voterNamesMap = {}
    if (voterClerkIds.size > 0) {
      const users = await User.find({ clerkId: { $in: Array.from(voterClerkIds) } })
      users.forEach(u => {
        voterNamesMap[u.clerkId] = `${u.firstName} ${u.lastName}`.trim() || u.email
      })
    }

    return NextResponse.json({
      success: true,
      data: posts,
      voterNames: voterNamesMap
    })

  } catch (error) {
    console.error('Erreur GET /api/global/feed:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la récupération du fil global' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/global/feed
 * Publie une annonce ou un sondage global pour l'école.
 */
export async function POST(request) {
  try {
    const userId = await requireAuth(request, 'POST /api/global/feed')
    if (userId instanceof NextResponse) return userId

    await dbConnect()

    // Vérifier si l'utilisateur est admin ou prof
    const currentUserDoc = await User.findOne({ clerkId: userId })
    const isAdmin = currentUserDoc?.role === 'admin'
    const isTeacher = currentUserDoc?.role === 'prof'

    if (!isAdmin && !isTeacher) {
      return NextResponse.json({ error: 'Non autorisé à publier des annonces globales' }, { status: 403 })
    }

    const body = await request.json()
    const { content, mediaUrls, type, pollQuestion, pollOptions, pollSettings } = body

    if (type === 'POLL') {
      if (!pollQuestion) {
        return NextResponse.json({ error: 'La question du sondage est requise' }, { status: 400 })
      }
      if (!pollOptions || !Array.isArray(pollOptions) || pollOptions.length < 2) {
        return NextResponse.json({ error: 'Au moins 2 options sont requises pour un sondage' }, { status: 400 })
      }
    } else {
      if (!content) {
        return NextResponse.json({ error: 'Le contenu du message est requis' }, { status: 400 })
      }
    }

    // Récupérer le nom de l'auteur
    const authorName = currentUserDoc ? `${currentUserDoc.firstName} ${currentUserDoc.lastName}`.trim() || currentUserDoc.email : 'Enseignant'

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    const newPost = new Post({
      schoolKey,
      isGlobal: true,
      authorId: userId,
      authorName,
      content,
      mediaUrls: mediaUrls || [],
      type: type || 'ANNOUNCEMENT',
      pollQuestion,
      pollOptions: pollOptions ? pollOptions.map((opt, index) => ({
        id: `opt_${index}_${Date.now()}`,
        text: typeof opt === 'string' ? opt : opt.text,
        voters: []
      })) : [],
      pollSettings: pollSettings || { multipleChoices: false, isAnonymous: false }
    })

    const savedPost = await newPost.save()

    return NextResponse.json({
      success: true,
      data: savedPost
    }, { status: 201 })

  } catch (error) {
    console.error('Erreur POST /api/global/feed:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la publication globale' },
      { status: 500 }
    )
  }
}

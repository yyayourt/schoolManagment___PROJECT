import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

const Group = require('../../../_/models/ai/Group')
const Post = require('../../../_/models/ai/Post')
const User = require('../../../_/models/ai/User')
import { resolveSchoolKey } from '../../../lib/schoolScope';

/**
 * GET /api/groups/[id]/feed
 * Récupère tous les posts publiés sur le mur d'actualités du groupe.
 */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const userId = await requireAuth(request, `GET /api/groups/${id}/feed`)
    if (userId instanceof NextResponse) return userId

    await dbConnect()

    // Vérifier si l'utilisateur est membre du groupe
    const group = await Group.findById(id)
    if (!group) {
      return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 })
    }

    const isMember = group.members.some(m => m.userId === userId)
    const isCreator = group.creatorId === userId
    const currentUserDoc = await User.findOne({ clerkId: userId })
    const isAdmin = currentUserDoc?.role === 'admin'

    if (!isMember && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Non autorisé à accéder à ce groupe' }, { status: 403 })
    }

    const schoolKey = await resolveSchoolKey()

    // Récupérer les posts triés par date décroissante
    const posts = await Post.find({ schoolKey, groupId: id }).sort({ createdAt: -1 })

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
    console.error('Erreur GET /api/groups/[id]/feed:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la récupération du mur d\'actualités' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/groups/[id]/feed
 * Publie un message sur le mur d'actualités du groupe.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const userId = await requireAuth(request, `POST /api/groups/${id}/feed`)
    if (userId instanceof NextResponse) return userId

    await dbConnect()

    const group = await Group.findById(id)
    if (!group) {
      return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 })
    }

    // Vérifier si l'utilisateur est membre
    const isMember = group.members.some(m => m.userId === userId)
    const isCreator = group.creatorId === userId
    const currentUserDoc = await User.findOne({ clerkId: userId })
    const isAdmin = currentUserDoc?.role === 'admin'

    if (!isMember && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Non autorisé à publier dans ce groupe' }, { status: 403 })
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
    const authorUser = await User.findOne({ clerkId: userId })
    const authorName = authorUser ? `${authorUser.firstName} ${authorUser.lastName}`.trim() || authorUser.email : 'Utilisateur'

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    const newPost = new Post({
      schoolKey,
      groupId: id,
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
    console.error('Erreur POST /api/groups/[id]/feed:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la publication sur le mur' },
      { status: 500 }
    )
  }
}

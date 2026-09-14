import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAuth } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

const Group = require('../../../_/models/ai/Group')
const GroupMessage = require('../../../_/models/ai/GroupMessage')
const User = require('../../../_/models/ai/User')
import { resolveSchoolKey } from '../../../lib/schoolScope';

/**
 * GET /api/groups/[id]/chat
 * Récupère les derniers messages de la discussion instantanée du groupe.
 */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const userId = await requireAuth(request, `GET /api/groups/${id}/chat`)
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

    // Récupérer les 100 derniers messages de chat triés chronologiquement
    const messages = await GroupMessage.find({ schoolKey, groupId: id })
      .sort({ createdAt: -1 })
      .limit(100)

    // Retourner les messages dans l'ordre chronologique (plus ancien au plus récent)
    return NextResponse.json({
      success: true,
      data: messages.reverse()
    })

  } catch (error) {
    console.error('Erreur GET /api/groups/[id]/chat:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la récupération des messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/groups/[id]/chat
 * Envoie un message dans le chat du groupe.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const userId = await requireAuth(request, `POST /api/groups/${id}/chat`)
    if (userId instanceof NextResponse) return userId

    await dbConnect()

    const group = await Group.findById(id)
    if (!group) {
      return NextResponse.json({ error: 'Groupe introuvable' }, { status: 404 })
    }

    // Vérifier si l'utilisateur est membre du groupe
    const isMember = group.members.some(m => m.userId === userId)
    const isCreator = group.creatorId === userId
    const currentUserDoc = await User.findOne({ clerkId: userId })
    const isAdmin = currentUserDoc?.role === 'admin'

    if (!isMember && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Non autorisé à participer à la discussion' }, { status: 403 })
    }

    const body = await request.json()
    const { content } = body

    if (!content) {
      return NextResponse.json({ error: 'Le contenu du message est requis' }, { status: 400 })
    }

    // Récupérer le nom de l'expéditeur
    const senderUser = await User.findOne({ clerkId: userId })
    const senderName = senderUser ? `${senderUser.firstName} ${senderUser.lastName}`.trim() || senderUser.email : 'Utilisateur'

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    const newMessage = new GroupMessage({
      schoolKey,
      groupId: id,
      senderId: userId,
      senderName,
      content
    })

    const savedMessage = await newMessage.save()

    return NextResponse.json({
      success: true,
      data: savedMessage
    }, { status: 201 })

  } catch (error) {
    console.error('Erreur POST /api/groups/[id]/chat:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors de l\'envoi du message' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../../../lib/authWithFallback'
import dbConnect from '../../../lib/dbConnect'

const mongoose = require('mongoose')
const Conversation = require('../../../_/models/ai/Conversation')
const Message = require('../../../_/models/ai/Message')
import { resolveSchoolKey } from '../../../lib/schoolScope';

/**
 * GET /api/conversations/{id}/messages
 * Renvoie les messages d'une conversation (ordre chronologique) si le demandeur
 * est participant (403 sinon — impossible de lire un fil dont on ne fait pas partie).
 * Marque au passage comme lus les messages reçus par le demandeur (accusé de lecture).
 * Chaque message est tagué `mine` (calculé côté serveur) pour l'alignement des bulles
 * sans exposer/deviner le clerkId côté client (robuste y compris en mode démo).
 */
export async function GET(request, { params }) {
  try {
    const authResult = await authWithFallback(request, 'GET /api/conversations/[id]/messages')
    if (!authResult.success) return authResult.response
    const me = authResult.userId

    await dbConnect()

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'id invalide' }, { status: 400 })
    }

    const conversation = await Conversation.findById(id)
      .populate('studentRef', 'nom prenoms')
      .populate('teacherRef', 'nom prenoms')
    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversation non trouvée' }, { status: 404 })
    }
    if (!conversation.participants.includes(me)) {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    }

    const schoolKey = await resolveSchoolKey()

    // Marquer comme lus les messages reçus non encore lus.
    await Message.updateMany(
      { schoolKey, conversationId: id, senderId: { $ne: me }, readBy: { $ne: me } },
      { $addToSet: { readBy: me } }
    )

    const raw = await Message.find({ schoolKey, conversationId: id }).sort({ createdAt: 1 }).lean()
    const messages = raw.map((m) => ({ ...m, mine: m.senderId === me }))

    return NextResponse.json({ success: true, data: { conversation, messages } })
  } catch (error) {
    console.error('❌ [API] GET /api/conversations/[id]/messages:', error)
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement des messages' }, { status: 500 })
  }
}

/**
 * POST /api/conversations/{id}/messages
 * Envoie un message. Body : { content }. 403 si non participant.
 * Met à jour lastMessage/lastMessagePreview/updatedAt de la conversation.
 */
export async function POST(request, { params }) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/conversations/[id]/messages')
    if (!authResult.success) return authResult.response
    const me = authResult.userId

    await dbConnect()

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'id invalide' }, { status: 400 })
    }

    const conversation = await Conversation.findById(id)
    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversation non trouvée' }, { status: 404 })
    }
    if (!conversation.participants.includes(me)) {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return NextResponse.json({ success: false, error: 'Le message est vide' }, { status: 400 })
    }
    if (content.length > 4000) {
      return NextResponse.json({ success: false, error: 'Message trop long (4000 max)' }, { status: 400 })
    }

    const schoolKey = await resolveSchoolKey()
    if (!schoolKey) {
      return NextResponse.json({ success: false, error: 'Accès refusé : schoolKey manquant' }, { status: 403 })
    }

    const message = await Message.create({
      schoolKey,
      conversationId: id,
      senderId: me,
      content,
      readBy: [me],
    })

    conversation.lastMessage = message._id
    conversation.lastMessagePreview = content.slice(0, 120)
    conversation.updatedAt = new Date()
    await conversation.save()

    return NextResponse.json({ success: true, data: { ...message.toObject(), mine: true } }, { status: 201 })
  } catch (error) {
    console.error('❌ [API] POST /api/conversations/[id]/messages:', error)
    return NextResponse.json({ success: false, error: "Erreur lors de l'envoi du message" }, { status: 500 })
  }
}

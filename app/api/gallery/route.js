import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authWithFallback } from '../lib/authWithFallback'
import dbConnect from '../lib/dbConnect'
import { resolveGalleryAccess, canAccessAlbum, canModerateAlbum } from '../lib/galleryAccess'
import { academicYearOf } from '../lib/academicYear'
import { signedUrl } from '../lib/cloudinaryMedia'

const MediaAlbum = require('../_/models/ai/MediaAlbum')
import { resolveSchoolKey } from '../lib/schoolScope';
require('../_/models/ai/Classe')

// Miniature signée de couverture (petite). Null si pas d'image ou fallback non signable.
function coverUrl(album) {
  const first = album.images?.[0]
  if (!first) return null
  if (first.publicId) {
    return signedUrl(first.publicId, { transformation: [{ width: 600, height: 400, crop: 'fill', quality: 'auto' }] }) || first.url
  }
  return first.url // fallback local
}

/**
 * GET /api/gallery?year=AAAA-AAAA
 * Liste des albums (ayant au moins une photo) de l'année scolaire demandée,
 * triés du plus récent au plus ancien. RGPD : pour un album restreint auquel
 * l'utilisateur n'a pas accès, on ne renvoie QUE des métadonnées (locked:true),
 * jamais d'URL d'image.
 */
export async function GET(request) {
  try {
    const authResult = await authWithFallback(request, 'GET /api/gallery')
    if (!authResult.success) return authResult.response

    await dbConnect()

    const access = await resolveGalleryAccess(authResult.userId)

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || academicYearOf()

    const schoolKey = await resolveSchoolKey()

    const albums = await MediaAlbum.find({ schoolKey, academicYear: year, 'images.0': { $exists: true } })
      .populate('classId', 'niveau alias annee')
      .sort({ date: -1 })
      .lean()

    const data = albums.map((album) => {
      const allowed = canAccessAlbum(access, album)
      const className = album.classId ? `${album.classId.niveau || ''} ${album.classId.alias || ''}`.trim() : null
      const base = {
        _id: album._id,
        title: album.title,
        date: album.date,
        academicYear: album.academicYear,
        isGlobal: album.isGlobal,
        eventId: album.eventId || null,
        classId: album.classId?._id || album.classId || null,
        className,
        imageCount: album.images.length,
        locked: !allowed,
        canModerate: canModerateAlbum(access, album),
      }
      // RGPD : on n'expose une couverture QUE si l'accès est accordé.
      base.cover = allowed ? coverUrl(album) : null
      return base
    })

    return NextResponse.json({ success: true, data, year })
  } catch (error) {
    console.error('❌ [API] GET /api/gallery:', error)
    return NextResponse.json({ success: false, error: 'Erreur lors du chargement de la galerie' }, { status: 500 })
  }
}

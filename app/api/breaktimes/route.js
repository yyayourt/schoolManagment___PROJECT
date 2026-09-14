import { NextResponse } from 'next/server';
import { withAuth } from '../lib/withAuth';
const BreakTime = require('../_/models/ai/BreakTime');

/**
 * GET /api/breaktimes
 * Récupère les pauses actives, optionnellement filtrées par niveau
 */
export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const niveau = searchParams.get('niveau');
    const jour = searchParams.get('jour');

    let breaks;

    if (jour) {
      // Récupérer les pauses pour un jour spécifique
      breaks = await BreakTime.getBreaksByDay(jour, niveau);
    } else {
      // Récupérer toutes les pauses actives
      breaks = await BreakTime.getActiveBreaks(niveau);
    }

    return NextResponse.json({
      success: true,
      data: breaks
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des pauses:', error);
    return NextResponse.json({
      success: false,
      error: 'Erreur serveur lors de la récupération des pauses'
    }, { status: 500 });
  }
}, { context: 'GET /api/breaktimes' });

/**
 * POST /api/breaktimes
 * Crée une nouvelle pause
 */
export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
    const {
      nom,
      heureDebut,
      heureFin,
      type,
      joursApplicables,
      niveauxConcernes,
      couleur,
      ordre
    } = body;

    // Validation des données requises
    if (!nom || !heureDebut || !heureFin) {
      return NextResponse.json({
        success: false,
        error: 'Nom, heure de début et heure de fin sont requis'
      }, { status: 400 });
    }

    // Vérification que l'heure de fin est après l'heure de début
    if (heureFin <= heureDebut) {
      return NextResponse.json({
        success: false,
        error: 'L\'heure de fin doit être après l\'heure de début'
      }, { status: 400 });
    }

    // Création de la nouvelle pause
    const newBreakTime = new BreakTime({
      nom,
      heureDebut,
      heureFin,
      type: type || 'recreation',
      joursApplicables: joursApplicables || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
      niveauxConcernes: niveauxConcernes || [],
      couleur: couleur || '#ffa726',
      ordre: ordre || 0
    });

    const savedBreakTime = await newBreakTime.save();

    return NextResponse.json({
      success: true,
      data: savedBreakTime,
      message: 'Pause créée avec succès'
    }, { status: 201 });

  } catch (error) {
    console.error('Erreur lors de la création de la pause:', error);
    return NextResponse.json({
      success: false,
      error: 'Erreur serveur lors de la création de la pause'
    }, { status: 500 });
  }
}, { context: 'POST /api/breaktimes', anyRole: true });

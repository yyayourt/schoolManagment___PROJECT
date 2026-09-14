import { NextResponse } from 'next/server';
import dbConnect from '../lib/dbConnect';
import Salle from '../_/models/ai/Salle';
import { requireFamilyScope } from '../lib/familyScope';

export async function GET(req) {
  try {
    const scope = await requireFamilyScope(req);
    if (scope.error) return scope.error;

    await dbConnect();
    const schoolKey = scope.schoolKey;

    let salles = await Salle.find({ schoolKey }).sort({ nom: 1 });

    // Auto-seed de quelques salles de démonstration si aucune salle n'est enregistrée
    if (salles.length === 0) {
      const defaultSalles = [
        { schoolKey, nom: 'Salle 101 (Classique)', type: 'CLASSIQUE', capacite: 30, etage: 1 },
        { schoolKey, nom: 'Salle 102 (Classique)', type: 'CLASSIQUE', capacite: 30, etage: 1 },
        { schoolKey, nom: 'Labo SVT / Chimie (103)', type: 'LABO', capacite: 20, equipements: ['Microscopes', 'Paillasses'], etage: 1 },
        { schoolKey, nom: 'Salle Informatique (201)', type: 'INFORMATIQUE', capacite: 25, equipements: ['Postes PC', 'Imprimante 3D'], etage: 2 },
        { schoolKey, nom: 'Gymnase / Terrain EPS', type: 'SPORT', capacite: 60, etage: 0 },
        { schoolKey, nom: 'Salle de Permanence', type: 'PERMANENCE', capacite: 40, etage: 0 },
        { schoolKey, nom: 'CDI - Centre de Doc', type: 'CDI', capacite: 35, etage: 0 }
      ];
      salles = await Salle.insertMany(defaultSalles);
    }

    return NextResponse.json({ success: true, data: salles });
  } catch (error) {
    console.error('Erreur GET /api/salles:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const scope = await requireFamilyScope(req, { staffOnly: true });
    if (scope.error) return scope.error;

    await dbConnect();
    const schoolKey = scope.schoolKey;
    const body = await req.json();

    const salle = await Salle.create({
      ...body,
      schoolKey
    });

    return NextResponse.json({ success: true, data: salle });
  } catch (error) {
    console.error('Erreur POST /api/salles:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

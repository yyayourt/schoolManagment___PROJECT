import dbConnect from '../../lib/dbConnect';
import CarnetEntry from '../../_/models/ai/CarnetEntry';
import { NextResponse } from 'next/server';
import { getAuthAndRole } from '../../../../utils/roles';

export async function GET(request) {
  try {
    const { success } = await getAuthAndRole(request);
    if (!success) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    await dbConnect();

    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const schoolKey = cookieStore.get('x-school-key')?.value || 'ecole_st_martin';

    const { searchParams } = new URL(request.url);
    const eleveId = searchParams.get('eleveId');

    const query = { schoolKey };
    if (eleveId) query.eleveId = eleveId;

    const entries = await CarnetEntry.find(query)
      .populate('eleveId', 'nom prenoms current_classe photo')
      .sort({ createdAt: -1 });

    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération du carnet', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { success } = await getAuthAndRole(request);
    if (!success) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    await dbConnect();

    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const schoolKey = cookieStore.get('x-school-key')?.value || 'ecole_st_martin';

    const body = await request.json();

    if (!body.eleveId || !body.auteurId || !body.contenu) {
      return NextResponse.json({ error: 'Les champs eleveId, auteurId et contenu sont requis' }, { status: 400 });
    }

    const newEntry = await CarnetEntry.create({
      schoolKey,
      eleveId: body.eleveId,
      auteurId: body.auteurId,
      auteurRole: body.auteurRole || 'PROF',
      type: body.type || 'OBSERVATION',
      titre: body.titre || 'Billet de carnet',
      contenu: body.contenu,
      pieceJointe: body.pieceJointe || '',
      luParParent: false,
      signatureParent: false
    });

    const populated = await CarnetEntry.findById(newEntry._id)
      .populate('eleveId', 'nom prenoms current_classe photo');

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la création du mot dans le carnet', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { success } = await getAuthAndRole(request);
    if (!success) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    await dbConnect();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'L ID du mot de carnet est requis' }, { status: 400 });
    }

    if (updates.signatureParent === true && !updates.dateSignature) {
      updates.dateSignature = new Date();
    }
    if (updates.luParParent === true && !updates.dateLecture) {
      updates.dateLecture = new Date();
    }

    const updatedEntry = await CarnetEntry.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('eleveId', 'nom prenoms current_classe photo');

    if (!updatedEntry) {
      return NextResponse.json({ error: 'Mot de carnet non trouvé' }, { status: 404 });
    }

    return NextResponse.json(updatedEntry);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du mot de carnet', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { success, isAdmin } = await getAuthAndRole(request);
    if (!success || !isAdmin) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs/CPE' }, { status: 403 });
    }

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'L ID du mot de carnet est requis' }, { status: 400 });
    }

    const deleted = await CarnetEntry.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Mot de carnet non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Mot de carnet supprimé avec succès' });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression du mot de carnet', details: error.message }, { status: 500 });
  }
}

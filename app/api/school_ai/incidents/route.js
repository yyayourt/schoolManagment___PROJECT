import dbConnect from '../../lib/dbConnect';
import Incident from '../../_/models/ai/Incident';
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
    const classeId = searchParams.get('classeId');

    const query = { schoolKey };
    if (eleveId) query.eleveId = eleveId;
    if (classeId) query.classeId = classeId;

    const incidents = await Incident.find(query)
      .populate('eleveId', 'nom prenoms current_classe photo')
      .populate('rapporteurId', 'nom prenoms email')
      .populate('cpeId', 'nom prenoms email')
      .sort({ dateIncident: -1 });

    return NextResponse.json(incidents);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des incidents', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { success, isAdmin, isTeacher } = await getAuthAndRole(request);
    if (!success || (!isAdmin && !isTeacher)) {
      return NextResponse.json({ error: 'Accès non autorisé (Prof/Admin/CPE uniquement)' }, { status: 403 });
    }

    await dbConnect();

    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const schoolKey = cookieStore.get('x-school-key')?.value || 'ecole_st_martin';

    const body = await request.json();

    if (!body.eleveId || !body.rapporteurId || !body.description) {
      return NextResponse.json({ error: 'Les champs eleveId, rapporteurId et description sont requis' }, { status: 400 });
    }

    const newIncident = await Incident.create({
      schoolKey,
      eleveId: body.eleveId,
      rapporteurId: body.rapporteurId,
      cpeId: body.cpeId || null,
      classeId: body.classeId || null,
      dateIncident: body.dateIncident || new Date(),
      description: body.description,
      gravite: body.gravite || 'FAIBLE',
      sanction: body.sanction || {
        type: 'AUCUNE',
        details: '',
        travailAFaire: '',
        estSigneParParent: false
      }
    });

    const populated = await Incident.findById(newIncident._id)
      .populate('eleveId', 'nom prenoms current_classe photo')
      .populate('rapporteurId', 'nom prenoms email');

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la création de l incident', details: error.message }, { status: 500 });
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
      return NextResponse.json({ error: 'L ID de l incident est requis' }, { status: 400 });
    }

    const updatedIncident = await Incident.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('eleveId', 'nom prenoms current_classe photo')
      .populate('rapporteurId', 'nom prenoms email')
      .populate('cpeId', 'nom prenoms email');

    if (!updatedIncident) {
      return NextResponse.json({ error: 'Incident non trouvé' }, { status: 404 });
    }

    return NextResponse.json(updatedIncident);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de l incident', details: error.message }, { status: 500 });
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
      return NextResponse.json({ error: 'L ID de l incident est requis' }, { status: 400 });
    }

    const deleted = await Incident.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Incident non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Incident supprimé avec succès' });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression de l incident', details: error.message }, { status: 500 });
  }
}

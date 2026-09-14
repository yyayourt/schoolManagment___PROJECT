// API RESTful pour les enseignants
import dbConnect from '../../lib/dbConnect';
import Teacher from '../../_/models/ai/Teacher';
import { checkRole, Roles } from '../../../../utils/roles';
import { authWithFallback } from '../../lib/authWithFallback';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const authResult = await authWithFallback(request, 'GET /api/school_ai/enseignants');
    if (!authResult.success) {
      return authResult.response;
    }
    await dbConnect();
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const schoolKey = cookieStore.get('x-school-key')?.value || 'demo_master';

    console.log(`[BACKEND ENSEIGNANTS] GET /api/school_ai/enseignants - UserID: ${authResult.userId}, schoolKey: ${schoolKey}`);
    const enseignants = await Teacher.find({ schoolKey });
    console.log(`[BACKEND ENSEIGNANTS] 📊 Enseignants trouvés (schoolKey: ${schoolKey}): ${enseignants.length}`);
    return NextResponse.json(enseignants);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des enseignants' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!(await checkRole(Roles.ADMIN, request))) {
      return NextResponse.json({ error: 'Accès refusé (Admin requis)' }, { status: 403 });
    }
    await dbConnect();
    const body = await request.json();

    // Strict Server Validation
    if (!body.nom || !body.prenoms || !body.sexe || !body.phone_$_tel || !body.email_$_email) {
      return NextResponse.json({ error: 'Données invalides : champs requis manquants.' }, { status: 400 });
    }
    if (!['M', 'F'].includes(body.sexe)) {
      return NextResponse.json({ error: 'Sexe invalide (M ou F attendu).' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email_$_email)) {
      return NextResponse.json({ error: 'Format d\'email invalide.' }, { status: 400 });
    }
    console.log('🔍 DEBUG API POST - Données reçues:', body);
    console.log('🔍 DEBUG API POST - Type current_classes:', typeof body.current_classes);
    console.log('🔍 DEBUG API POST - Valeur current_classes:', body.current_classes);
    console.log('🔍 DEBUG API POST - Est un array?', Array.isArray(body.current_classes));

    const created = await Teacher.create(body);
    console.log('🔍 DEBUG API POST - Données sauvegardées:', created);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('❌ Erreur création enseignant:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de l\'enseignant' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!(await checkRole(Roles.ADMIN, request))) {
      return NextResponse.json({ error: 'Accès refusé (Admin requis)' }, { status: 403 });
    }
    await dbConnect();
    const body = await request.json();

    // Strict Server Validation
    if (!body._id) {
      return NextResponse.json({ error: 'L\'ID de l\'enseignant est requis pour la mise à jour.' }, { status: 400 });
    }
    if (body.sexe && !['M', 'F'].includes(body.sexe)) {
      return NextResponse.json({ error: 'Sexe invalide (M ou F attendu).' }, { status: 400 });
    }
    if (body.email_$_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email_$_email)) {
        return NextResponse.json({ error: 'Format d\'email invalide.' }, { status: 400 });
      }
    }

    // Utiliser .save() pour déclencher les middlewares de synchronisation
    const teacher = await Teacher.findById(body._id);
    if (!teacher) {
      return NextResponse.json({ error: 'Enseignant non trouvé' }, { status: 404 });
    }

    console.log('🔍 DEBUG API: Avant modification - current_classes:', teacher.current_classes);
    console.log('🔍 DEBUG API: Nouvelles current_classes:', body.current_classes);
    console.log('🔍 DEBUG API: naissance_$_date reçue:', body.naissance_$_date, typeof body.naissance_$_date);

    // Capturer l'ancienne valeur avant modification pour le middleware
    teacher._original = teacher.toObject();

    // Convertir la date de naissance si elle est en format string
    if (body.naissance_$_date && typeof body.naissance_$_date === 'string') {
      const timestamp = new Date(body.naissance_$_date).getTime();
      if (!isNaN(timestamp)) {
        body.naissance_$_date = timestamp;
        console.log('🔍 DEBUG API: Date convertie en timestamp:', timestamp);
      } else {
        console.log('❌ DEBUG API: Date invalide, conversion échouée');
      }
    }

    // Mettre à jour les propriétés
    Object.assign(teacher, body);

    // Forcer la détection de modification si current_classes a changé
    const oldClasses = teacher._original.current_classes || [];
    const newClasses = body.current_classes || [];
    const hasChanged = JSON.stringify(oldClasses.sort()) !== JSON.stringify(newClasses.sort());

    if (hasChanged) {
      teacher.markModified('current_classes');
      console.log('🔍 DEBUG API: current_classes marqué comme modifié');
      console.log('🔍 DEBUG API: Anciennes classes:', oldClasses);
      console.log('🔍 DEBUG API: Nouvelles classes:', newClasses);
    }

    // Sauvegarder (déclenche les middlewares)
    console.log('🔍 DEBUG API: Avant save(), current_classes:', teacher.current_classes);
    const updated = await teacher.save();
    console.log('🔍 DEBUG API: Après save(), middleware devrait se déclencher');

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'enseignant:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de l\'enseignant' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!(await checkRole(Roles.ADMIN, request))) {
      return NextResponse.json({ error: 'Accès refusé (Admin requis)' }, { status: 403 });
    }
    await dbConnect();
    const body = await request.json();

    // Utiliser findOneAndDelete pour déclencher les middlewares de nettoyage
    const deleted = await Teacher.findOneAndDelete({ _id: body._id });

    if (!deleted) {
      return NextResponse.json({ error: 'Enseignant non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'enseignant:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression de l\'enseignant' }, { status: 500 });
  }
}

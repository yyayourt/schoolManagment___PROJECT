// API RESTful pour les élèves
import dbConnect from '../../lib/dbConnect';
import Eleve from '../../_/models/ai/Eleve';
import { NextResponse } from 'next/server';
import { checkRole, getAuthAndRole, Roles } from '../../../../utils/roles';
import { authWithFallback } from '../../lib/authWithFallback';
import User from '../../_/models/ai/User';

export async function GET(request) {
  try {
    const { success, userId, isAdmin, isTeacher } = await getAuthAndRole(request);
    if (!success) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 401 });
    }

    await dbConnect();

    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const schoolKey = cookieStore.get('x-school-key')?.value || 'demo_master';

    console.log(`[BACKEND ELEVES] MONGODB_URI: ${process.env.MONGODB_URI?.split('@')[1] || 'N/A'}, schoolKey: ${schoolKey}`);

    if (isAdmin) {
      const eleves = await Eleve.find({ schoolKey });
      console.log(`[BACKEND ELEVES] 📊 Élèves trouvés pour Admin (schoolKey: ${schoolKey}): ${eleves.length}`);
      return NextResponse.json(eleves);
    }

    if (isTeacher) {
      // Teacher flow: filter students by assigned classes
      const user = await User.findOne({ clerkId: userId }).populate('roleData.teacherRef');
      if (user && user.role === 'prof' && user.roleData?.teacherRef) {
        const teacherClasses = user.roleData.teacherRef.current_classes;
        const eleves = await Eleve.find({ schoolKey, current_classe: { $in: teacherClasses } })
          .select('-scolarity_fees_$_checkbox');
        return NextResponse.json(eleves);
      }
    }

    // Family (Parent / Élève) & Sandbox flow: return school students
    const eleves = await Eleve.find({ schoolKey }).select('-scolarity_fees_$_checkbox');
    return NextResponse.json(eleves);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des élèves', details: error.message }, { status: 500 });
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
    if (!body.nom || !body.prenoms || !body.sexe || !body.naissance_$_date || !body.current_classe) {
      return NextResponse.json({ error: 'Données invalides : champs requis manquants.' }, { status: 400 });
    }
    if (!['M', 'F'].includes(body.sexe)) {
      return NextResponse.json({ error: 'Sexe invalide (M ou F attendu).' }, { status: 400 });
    }

    const created = await Eleve.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la création de l\'élève' }, { status: 500 });
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
      return NextResponse.json({ error: 'L\'ID de l\'élève est requis pour la mise à jour.' }, { status: 400 });
    }
    if (body.sexe && !['M', 'F'].includes(body.sexe)) {
      return NextResponse.json({ error: 'Sexe invalide (M ou F attendu).' }, { status: 400 });
    }

    // Utiliser .save() pour déclencher les middlewares de synchronisation
    const eleve = await Eleve.findById(body._id);
    if (!eleve) {
      return NextResponse.json({ error: 'Élève non trouvé' }, { status: 404 });
    }

    // Capturer l'ancienne valeur avant modification pour le middleware
    eleve._original = eleve.toObject();

    // Mettre à jour les propriétés (maintenant que cloudinary est dans le schéma)
    Object.assign(eleve, body);

    // Forcer la détection de modification si current_classe a changé
    if (body.current_classe && body.current_classe !== eleve._original.current_classe?.toString()) {
      eleve.markModified('current_classe');
    }

    // Sauvegarder (déclenche les middlewares)
    const updated = await eleve.save();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'élève:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour de l\'élève' }, { status: 500 });
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
    const deleted = await Eleve.findOneAndDelete({ _id: body._id });

    if (!deleted) {
      return NextResponse.json({ error: 'Élève non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'élève:', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression de l\'élève' }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import { getAuthAndRole } from '../../../../utils/roles';
import Classe from '../../_/models/ai/Classe';
import Eleve from '../../_/models/ai/Eleve';
import Teacher from '../../_/models/ai/Teacher';
import Subject from '../../_/models/ai/Subject';
import SchoolSettings from '../../_/models/ai/SchoolSettings';

export async function GET(request) {
  try {
    // 1. Authentification & Rôle UNIFIÉS (1 seule vérification)
    const { success, userId, role, isAdmin, isTeacher } = await getAuthAndRole(request);
    if (!success) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    await dbConnect();

    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const schoolKey = cookieStore.get('x-school-key')?.value || 'demo_master';

    // 2. Exécution PARALLÈLE de toutes les requêtes en base de données
    const [classes, eleves, enseignants, rawSubjects, settings] = await Promise.all([
      Classe.find({ schoolKey }),
      Eleve.find({ schoolKey }),
      Teacher.find({ schoolKey }),
      Subject.find({ schoolKey, isActive: true }),
      SchoolSettings.findOne({ schoolKey })
    ]);

    const subjects = rawSubjects.map(s => ({
      id: s._id || s.id,
      nom: s.nom
    }));

    const defaultHomepage = {
      title: 'École de Démo',
      slogan: 'Système de gestion scolaire',
      texts: ['Bienvenue sur l\'application de gestion scolaire.'],
      photo: '/ecole_testes/photo.jpg',
      logoUrl: '/logo.png',
      bannerUrl: '/bg_header.webp',
      primaryColor: '#1E3A8A',
      accentColor: '#F97316'
    };

    return NextResponse.json({
      classes,
      eleves,
      enseignants,
      subjects,
      ecole: {
        feeDefinitions: settings?.feeDefinitions ?? [],
        targets: settings?.targets ?? [],
        homepage: settings?.homepage ? { ...defaultHomepage, ...settings.homepage.toObject?.() ?? settings.homepage } : defaultHomepage
      }
    });

  } catch (error) {
    console.error('❌ Erreur GET /api/school_ai/bootstrap:', error);
    return NextResponse.json({ error: 'Erreur lors du chargement des données', details: error.message }, { status: 500 });
  }
}

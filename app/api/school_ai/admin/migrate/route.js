import dbConnect from '../../../lib/dbConnect';
import Classe from '../../../_/models/ai/Classe';
import { NextResponse } from 'next/server';
import { checkRole, Roles } from '../../../../../utils/roles';
import { authWithFallback } from '../../../lib/authWithFallback';
import { resolveSchoolKey } from '../../../lib/schoolScope';

export async function POST(request) {
  try {
    const authResult = await authWithFallback(request, 'POST /api/school_ai/admin/migrate');
    if (!authResult.success) {
      return authResult.response;
    }

    if (!(await checkRole(Roles.ADMIN, request))) {
      return NextResponse.json({ error: 'Accès refusé (Admin requis)' }, { status: 403 });
    }

    await dbConnect();

    const schoolKey = await resolveSchoolKey();

    const classes = await Classe.find({ schoolKey });
    const results = [];

    for (const classe of classes) {
      // 1. Détecter l'année actuelle (format YYYY-YYYY attendu)
      const currentYear = classe.annee;
      if (!currentYear || !/^\d{4}-\d{4}$/.test(currentYear)) {
        results.push({ id: classe._id, status: "skipped", reason: "Annee invalide ou manquante" });
        continue;
      }

      // 2. Calculer l'année suivante
      const years = currentYear.split('-');
      const y1 = parseInt(years[0]);
      const y2 = parseInt(years[1]);
      const nextYear = `${y1 + 1}-${y2 + 1}`;

      // 3. CAPTURE : Créer un snapshot de toutes les propriétés actuelles
      const snapshot = {
        annee: currentYear,
        eleves: (classe.eleves || []).map(id => id.toString()),
        professeur: (classe.professeur || []).map(id => id.toString()),
        homework: classe.homework || {},
        compositions: [...(classe.compositions || [])],
        coefficients: classe.coefficients || {},
        moyenne_trimetriel: [...(classe.moyenne_trimetriel || ["", "", ""])],
        commentaires: [...(classe.commentaires || [])],
        schedules: [...(classe.schedules || [])],
        currentScheduleId: classe.currentScheduleId,
        createdAt: classe.createdAt,
        cloudinary: classe.cloudinary,
        reports: [...(classe.reports || [])],
        migratedAt: +new Date()
      };

      // 4. ARCHIVE : Ajouter le snapshot dans l'historique
      if (!Array.isArray(classe.history)) classe.history = [];
      classe.history.push(snapshot);

      // 5. UPDATE & RESET : Mettre à jour l'année et réinitialiser les champs spécifiés
      classe.annee = nextYear;
      classe.createdAt = (+new Date()).toString();
      
      // Champs à vider/réinitialiser selon les instructions
      classe.eleves = [];
      classe.professeur = [];
      classe.compositions = [];
      classe.commentaires = [];
      classe.reports = [];
      classe.cloudinary = null;
      classe.moyenne_trimetriel = ["", "", ""];
      classe.homework = {};
      
      // Note: coefficients, niveau, alias et photo restent inchangés

      // 6. Sauvegarder
      classe.markModified('history');
      classe.markModified('eleves');
      classe.markModified('professeur');
      classe.markModified('compositions');
      classe.markModified('commentaires');
      classe.markModified('reports');
      classe.markModified('moyenne_trimetriel');
      classe.markModified('homework');
      
      await classe.save();
      results.push({ id: classe._id, level: classe.niveau, oldYear: currentYear, newYear: nextYear });
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} classes migrées vers la nouvelle année scolaire avec succès.`,
      details: results
    });

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    return NextResponse.json({ error: 'Erreur lors de la migration des classes', details: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import { requireFamilyScope } from '../../lib/familyScope';
const Subject = require('../../_/models/ai/Subject');
import { MATIERES_SCOLAIRES } from '../../../../utils/matieres';

/**
 * POST /api/init/subjects
 * Route d'initialisation (personnel uniquement) pour créer les matières par défaut
 * À utiliser uniquement lors de la première configuration
 */
export async function POST(request) {
  try {
    const scope = await requireFamilyScope(request, { staffOnly: true });
    if (scope.error) return scope.error;

    await dbConnect();

    // Vérifier si des matières existent déjà
    const existingSubjects = await Subject.countDocuments();
    if (existingSubjects > 0) {
      return NextResponse.json({
        success: false,
        error: `${existingSubjects} matières existent déjà. Base déjà initialisée.`,
        count: existingSubjects
      }, { status: 400 });
    }

    // Matières par défaut créées à partir de MATIERES_SCOLAIRES
    const defaultSubjects = MATIERES_SCOLAIRES.map((matiere, index) => {
      // Générer une couleur en fonction de l'index pour avoir des couleurs variées
      const hue = (index * 137.5) % 360;
      const couleur = `hsl(${Math.round(hue)}, 70%, 50%)`;

      // Générer un code court (4 1ères lettres en majuscules)
      let code = matiere.substring(0, 4).toUpperCase();
      // s'il y a un espace ou tiret, prendre les premières lettres
      if (matiere.includes(' ') || matiere.includes('-')) {
        code = matiere.split(/[\s-]/).map(w => w[0]).join('').substring(0, 4).toUpperCase();
      }

      return {
        nom: matiere,
        code: code,
        couleur: couleur,
        niveaux: false, // Général
        dureeDefaut: 60
      };
    });

    // Debug : Vérifier le schéma du modèle
    console.log('🔍 Schéma Subject niveaux:', Subject.schema?.paths?.niveaux)
    console.log('🔍 Premier sujet à créer:', JSON.stringify(defaultSubjects[0], null, 2))

    // Créer les matières une par une pour debug
    const createdSubjects = []
    let hasError = false;
    for (const subjectData of defaultSubjects) {
      // Create independent block so variables are reissued
      try {
        console.log(`📝 Création de ${subjectData.nom} avec niveaux:`, subjectData.niveaux)
        const subject = new Subject(subjectData)
        await subject.validate() // Validation explicite
        const saved = await subject.save()
        createdSubjects.push(saved)
        console.log(`✅ ${subjectData.nom} créé avec succès`)
      } catch (err) {
        hasError = true;
        console.error(`❌ Erreur pour ${subjectData.nom}:`, err.message)
      }
    }


    return NextResponse.json({
      success: true,
      data: createdSubjects,
      message: `🎉 Initialisation réussie ! ${createdSubjects.length} matières primaires créées`,
      count: createdSubjects.length,
      subjects: createdSubjects.map(s => ({ nom: s.nom, code: s.code, niveaux: s.niveaux.length }))
    }, { status: 201 });

  } catch (error) {
    console.error('Erreur lors de l\'initialisation des matières:', error);
    return NextResponse.json({
      success: false,
      error: 'Erreur serveur lors de l\'initialisation des matières',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/init/subjects
 * Vérifier l'état d'initialisation (personnel uniquement)
 */
export async function GET(request) {
  try {
    const scope = await requireFamilyScope(request, { staffOnly: true });
    if (scope.error) return scope.error;

    await dbConnect();

    const existingCount = await Subject.countDocuments();
    const subjects = await Subject.find({}, 'nom code niveaux isActive').sort({ nom: 1 });

    return NextResponse.json({
      success: true,
      data: {
        isInitialized: existingCount > 0,
        subjectCount: existingCount,
        subjects: subjects.map(s => ({
          nom: s.nom,
          code: s.code,
          niveaux: s.niveaux.length,
          isActive: s.isActive
        }))
      },
      message: existingCount > 0
        ? `Base initialisée avec ${existingCount} matières`
        : 'Base non initialisée - aucune matière trouvée'
    });

  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    return NextResponse.json({
      success: false,
      error: 'Erreur serveur lors de la vérification',
      details: error.message
    }, { status: 500 });
  }
}

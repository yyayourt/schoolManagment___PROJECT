import Orientation3emeRaw from '../../../_/models/ai/Orientation3eme';
const Orientation3eme = Orientation3emeRaw.default || Orientation3emeRaw;

export async function generateOrientationForClassYear(currentClasse, activeStudentsDocs, year, schoolKey) {
  try {
    if (!currentClasse || !activeStudentsDocs || activeStudentsDocs.length === 0) return;

    // Génération uniquement si la classe est de niveau 3ème
    if (!currentClasse.niveau?.includes('3')) return;

    const VOIES = ['2NDE_GT', '2NDE_PRO', 'CAP', 'APPRENTISSAGE'];
    const AVIS = ['TRES_FAVORABLE', 'FAVORABLE', 'RESERVE', 'DEFAVORABLE'];
    const LYCEES = [
      'Lycée Carnot (Option Arts Plastiques)',
      'Lycée Pasteur (Section Internationale)',
      'Lycée Professionnel Eiffel (Bac Pro Cybersécurité)',
      'CFA Métiers de l\'Artisanat'
    ];

    const records = [];
    for (let i = 0; i < activeStudentsDocs.length; i++) {
      const eleve = activeStudentsDocs[i];
      const eleveId = eleve._id;

      const voeu1 = VOIES[i % VOIES.length];
      const voeu2 = VOIES[(i + 1) % VOIES.length];
      const avisChoice = AVIS[i % AVIS.length];
      const lycee = LYCEES[i % LYCEES.length];

      records.push({
        schoolKey,
        eleveId,
        annee: year,
        voeuxFamille: [
          { ordre: 1, voie: voeu1, specialiteOuEtablissement: lycee, statut: 'DEFINITIF' },
          { ordre: 2, voie: voeu2, specialiteOuEtablissement: 'Lycée Condorcet', statut: 'PROVISOIRE' }
        ],
        avisConseilClasse: {
          avis: avisChoice,
          commentaire: `Conseil du 2ème trimestre : avis ${avisChoice.toLowerCase()} sur le vœu 1 (${voeu1}).`
        },
        entretienOrientation: {
          realise: i % 2 === 0,
          dateEntretien: new Date(2024, 2, 10 + i),
          compteRendu: i % 2 === 0 ? 'Entretien réalisé en présence des parents. Validation du projet d orientation.' : ''
        },
        decisionChefEtablissement: {
          voieRetenue: voeu1,
          accordFamille: true
        }
      });
    }

    for (const record of records) {
      await Orientation3eme.findOneAndUpdate(
        { schoolKey, eleveId: record.eleveId, annee: year },
        { $set: record },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  } catch (err) {
    console.error('Error in generateOrientationForClassYear:', err);
  }
}

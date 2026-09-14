import InclusiveDeviceRaw from '../../../_/models/ai/InclusiveDevice';

const InclusiveDevice = InclusiveDeviceRaw.default || InclusiveDeviceRaw;

const INCLUSIVE_SAMPLES = [
  {
    type: 'PAP',
    diagnostiqueOuMotif: "Dyslexie visuo-attentionnelle et Dysorthographie sévère",
    amenagementsPedagogiques: [
      "Temps majoré de 1/3 pour toutes les évaluations écrites",
      "Support d'évaluation avec police aérée (OpenDyslexic ou Arial 12)",
      "Ne pas pénaliser l'orthographe dans les matières non littéraires",
      "Privilégier les évaluations orales ou les QCM"
    ],
    referentOuAesh: "Dr. Lemoine (Médecin Scolaire) / Orthophoniste de ville",
    notesConfidentielles: "Bilan orthophonique renouvelé en septembre. L'élève fait preuve de beaucoup de bonne volonté."
  },
  {
    type: 'PAI',
    diagnostiqueOuMotif: "Allergie alimentaire sévère (Arachides et Fruits à coque)",
    amenagementsPedagogiques: [
      "Panier repas individuel préparé par la famille pour la cantine",
      "Trousse d'urgence avec stylo d'adrénaline auto-injectable disponible à l'infirmerie",
      "Autorisation permanente de sortir de cours en cas de sensation de malaise"
    ],
    referentOuAesh: "Mme Caron (Infirmière Scolaire)",
    notesConfidentielles: "Protocole PAI signé par la famille et le médecin en début d'année scolaire."
  },
  {
    type: 'PPRE',
    diagnostiqueOuMotif: "Fragilités importantes en résolution de problèmes en Mathématiques",
    amenagementsPedagogiques: [
      "Autorisation de la table de Pythagore et de la calculatrice lors des exercices",
      "Fiches outils étape par étape fournies pour les devoirs",
      "Binôme de tutorat mis en place avec un élève tuteur en classe"
    ],
    referentOuAesh: "Mme Dubois (Professeur Principal)",
    notesConfidentielles: "Objectif du PPRE : consolider les automatismes de calcul d'ici la fin du T2."
  },
  {
    type: 'PPS',
    diagnostiqueOuMotif: "Trouble de la coordination motrice (Dyspraxie) — Notification MDPH",
    amenagementsPedagogiques: [
      "Présence d'un AESH mutualisé (12h par semaine)",
      "Utilisation autorisée de l'ordinateur portable en classe pour la prise de notes",
      "Fourniture de photocopies de cours aérées pour éviter la copie manuscrite",
      "Installation systématique au premier rang au centre"
    ],
    referentOuAesh: "M. Giraud (AESH) & Enseignant Référent ASH",
    notesConfidentielles: "Équipe de Suivi de la Scolarisation (ESS) prévue au Trimestre 2."
  }
];

export const generateInclusiveDevicesForClassYear = async (classe, activeStudentsDocs, year, schoolKey) => {
  if (!activeStudentsDocs || activeStudentsDocs.length === 0) return;

  // On attribue des dispositifs inclusifs aux 4 premiers élèves de la classe
  for (let i = 0; i < Math.min(activeStudentsDocs.length, 4); i++) {
    const eleve = activeStudentsDocs[i];
    const sample = INCLUSIVE_SAMPLES[i % INCLUSIVE_SAMPLES.length];

    const deviceDoc = new InclusiveDevice({
      schoolKey,
      eleveId: eleve._id,
      annee: year,
      devices: [
        {
          type: sample.type,
          statut: 'ACTIF',
          diagnostiqueOuMotif: sample.diagnostiqueOuMotif,
          amenagementsPedagogiques: sample.amenagementsPedagogiques,
          referentOuAesh: sample.referentOuAesh,
          notesConfidentielles: sample.notesConfidentielles,
          dateCreation: new Date(parseInt(year.split('-')[0]), 8, 15)
        }
      ]
    });

    await deviceDoc.save();
  }
};

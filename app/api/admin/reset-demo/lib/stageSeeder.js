import Stage3emeRaw from '../../../_/models/ai/Stage3eme';

const Stage3eme = Stage3emeRaw.default || Stage3emeRaw;

const SAMPLE_STAGES = [
  { entreprise: "Thales Aerospace", secteur: "Aéronautique & Défense", adresse: "12 Avenue de l'Europe, Meudon", tuteurNom: "M. Marc Vasseur", tuteurContact: "m.vasseur@thales.com / 06 12 34 56 78" },
  { entreprise: "Cabinet d'Architecture Linéaire", secteur: "Architecture & Urbanisme", adresse: "45 Rue de la République, Paris", tuteurNom: "Mme Sophie Delorme", tuteurContact: "s.delorme@lineaire-arch.fr / 06 88 99 11 22" },
  { entreprise: "Clinique Vétérinaire Saint-Martin", secteur: "Santé Vétérinaire", adresse: "8 Boulevard Pasteur, Paris", tuteurNom: "Dr. Antoine Roche", tuteurContact: "contact@veto-stmartin.fr / 01 45 67 89 00" },
  { entreprise: "Studio Nova Web & Design", secteur: "Numérique & Communication", adresse: "15 Rue des Arts, Paris", tuteurNom: "Mme Camille Dupont", tuteurContact: "camille@studionova.io / 06 55 44 33 22" },
  { entreprise: "Boulangerie-Pâtisserie L'Épi d'Or", secteur: "Artisanat / Métiers de Bouche", adresse: "2 Place du Marché, Paris", tuteurNom: "M. Pierre Lecomte", tuteurContact: "01 42 33 44 55" },
  { entreprise: "Laboratoire de Recherche CNRS", secteur: "Recherche Scientifique", adresse: "Zone Scientifique Paris-Saclay", tuteurNom: "Dr. Valérie Petit", tuteurContact: "valerie.petit@cnrs.fr / 01 69 85 00 00" },
  { entreprise: "Garage Automobile Express", secteur: "Mécanique & Automobile", adresse: "89 Avenue de la Grande Armée, Paris", tuteurNom: "M. Stéphane Meyer", tuteurContact: "smeyer@garage-express.fr" },
  { entreprise: "Pharmacie de l'Hôtel de Ville", secteur: "Santé & Pharmacie", adresse: "12 Rue de Rivoli, Paris", tuteurNom: "Mme Hélène Girard", tuteurContact: "h.girard@pharma-rivoli.fr" },
  { entreprise: "Librairie Les Mots Bleus", secteur: "Commerce & Culture", adresse: "34 Rue Mouffetard, Paris", tuteurNom: "M. Nicolas Fontaine", tuteurContact: "nicolas@motsbleus-librairie.fr" },
  { entreprise: "Studio d'Enregistrement SoundBox", secteur: "Audiovisuel & Musique", adresse: "7 Rue Oberkampf, Paris", tuteurNom: "M. Julien Renard", tuteurContact: "julien@soundbox.fr" },
  { entreprise: "Cabinet Vétérinaire des Lilas", secteur: "Santé Vétérinaire", adresse: "14 Rue des Lilas, Paris", tuteurNom: "Dr. Marie Lambert", tuteurContact: "marie@veto-lilas.fr" },
  { entreprise: "Hôtel & Spa Le Splendid", secteur: "Hôtellerie & Restauration", adresse: "1 Boulevard Haussmann, Paris", tuteurNom: "Mme Isabelle Roux", tuteurContact: "i.roux@lesplendid.fr" },
  { entreprise: "Centre Hospitalier Régional", secteur: "Santé & Paramédical", adresse: "15 Rue de la Santé, Paris", tuteurNom: "Dr. Philippe Mercier", tuteurContact: "p.mercier@chr-paris.fr" },
  { entreprise: "Atelier de Haute Couture Vaneau", secteur: "Mode & Textile", adresse: "22 Rue du Faubourg Saint-Honoré, Paris", tuteurNom: "Mme Béatrice Marchand", tuteurContact: "beatrice@vaneau-couture.fr" }
];

const APPRECIATIONS = ['EXCELLENT', 'BON', 'SATISFAISANT', 'INSUFFISANT'];
const MODALITES = ['SUR_PLACE', 'TELEPHONIQUE', 'VISIO'];

export const generateStagesForClassYear = async (classe, activeStudentsDocs, year, schoolKey, teachersList) => {
  if (classe.niveau !== '3ème') return;

  const startYear = parseInt(year.split('-')[0]);
  const dateDebut = new Date(startYear + 1, 0, 15); // 15 Janvier
  const dateFin = new Date(startYear + 1, 0, 20); // 20 Janvier

  for (let i = 0; i < activeStudentsDocs.length; i++) {
    const eleve = activeStudentsDocs[i];
    const sample = SAMPLE_STAGES[i % SAMPLE_STAGES.length];
    const teacher = teachersList[i % teachersList.length];

    // Notes réalistes (profil élève)
    const base = eleve.profileType === 'EXCELLENT' ? 17 : (eleve.profileType === 'MOYEN' ? 14 : 11);
    const noteEntreprise = Math.min(20, Math.max(8, base + Math.floor(Math.random() * 4) - 1));
    const noteRapport = Math.min(20, Math.max(8, base + Math.floor(Math.random() * 4) - 2));
    const noteSoutenance = Math.min(20, Math.max(8, base + Math.floor(Math.random() * 4) - 1));

    const sum = noteEntreprise + noteRapport + noteSoutenance;
    const moyenneStage = Math.round((sum / 3) * 10) / 10;

    const appreciationTuteur = noteEntreprise >= 16 ? 'EXCELLENT' : (noteEntreprise >= 14 ? 'BON' : (noteEntreprise >= 10 ? 'SATISFAISANT' : 'INSUFFISANT'));

    const stageDoc = new Stage3eme({
      schoolKey,
      eleveId: eleve._id,
      annee: year,
      entreprise: {
        nom: sample.entreprise,
        secteur: sample.secteur,
        adresse: sample.adresse,
        tuteurNom: sample.tuteurNom,
        tuteurContact: sample.tuteurContact
      },
      dates: {
        dateDebut,
        dateFin
      },
      statutConvention: i === 0 ? 'SIGNEE_FAMILLE' : 'VALIDE_PRINCIPAL',
      suiviVisite: {
        enseignantReferentNom: `M. ${teacher.nom}`,
        visiteEffectuee: true,
        dateVisite: new Date(startYear + 1, 0, 17),
        modalite: MODALITES[i % MODALITES.length],
        appreciationTuteur
      },
      evaluation: {
        noteEntreprise,
        noteRapport,
        noteSoutenance,
        moyenneStage,
        commentaireGlobal: `Stage d'observation très constructif chez ${sample.entreprise}. Élève ponctuel, curieux et bien préparé pour sa soutenance.`
      }
    });

    await stageDoc.save();
  }
};

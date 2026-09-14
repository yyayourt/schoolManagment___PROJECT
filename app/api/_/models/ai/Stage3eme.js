const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const stageSchema = new Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true },
  annee: { type: String, required: true, default: '2023-2024' },

  // Entreprise d'accueil
  entreprise: {
    nom: { type: String, default: '' },
    secteur: { type: String, default: '' },
    adresse: { type: String, default: '' },
    tuteurNom: { type: String, default: '' },
    tuteurContact: { type: String, default: '' }
  },

  // Dates du stage
  dates: {
    dateDebut: { type: Date },
    dateFin: { type: Date }
  },

  // Statut de la convention de stage
  statutConvention: {
    type: String,
    enum: ['EN_ATTENTE_RECHERCHE', 'EN_ATTENTE_SIGNATURE', 'SIGNEE_FAMILLE', 'VALIDE_PRINCIPAL', 'REFUSEE'],
    default: 'EN_ATTENTE_RECHERCHE'
  },

  // Suivi de l'enseignant référent / visite de stage
  suiviVisite: {
    enseignantReferentNom: { type: String, default: '' },
    visiteEffectuee: { type: Boolean, default: false },
    dateVisite: { type: Date },
    modalite: { type: String, enum: ['SUR_PLACE', 'TELEPHONIQUE', 'VISIO'], default: 'SUR_PLACE' },
    appreciationTuteur: { type: String, enum: ['EXCELLENT', 'BON', 'SATISFAISANT', 'INSUFFISANT', 'NON_EVALUE'], default: 'NON_EVALUE' }
  },

  // Notation du stage (sur 20 pts)
  evaluation: {
    noteEntreprise: { type: Number, min: 0, max: 20, default: null },
    noteRapport: { type: Number, min: 0, max: 20, default: null },
    noteSoutenance: { type: Number, min: 0, max: 20, default: null },
    moyenneStage: { type: Number, min: 0, max: 20, default: null },
    commentaireGlobal: { type: String, default: '' }
  }
}, { timestamps: true });

stageSchema.index({ schoolKey: 1, eleveId: 1, annee: 1 }, { unique: true });

let model;
if (!mongoose.modelNames().includes("Stage3eme")) {
  model = mongoose.model('Stage3eme', stageSchema);
} else {
  model = mongoose.model("Stage3eme");
}

module.exports = model;

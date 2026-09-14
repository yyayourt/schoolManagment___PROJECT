const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const orientationSchema = new Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true },
  annee: { type: String, required: true, default: '2023-2024' },

  // Vœux exprimés par l'élève / la famille
  voeuxFamille: [{
    ordre: { type: Number, required: true }, // 1, 2, 3
    voie: { 
      type: String, 
      enum: ['2NDE_GT', '2NDE_PRO', 'CAP', 'APPRENTISSAGE', 'AUTRE'], 
      required: true 
    },
    specialiteOuEtablissement: { type: String, default: '' },
    statut: { type: String, enum: ['PROVISOIRE', 'DEFINITIF'], default: 'PROVISOIRE' }
  }],

  // Avis émis par le Conseil de Classe
  avisConseilClasse: {
    avis: { 
      type: String, 
      enum: ['TRES_FAVORABLE', 'FAVORABLE', 'RESERVE', 'DEFAVORABLE', 'EN_ATTENTE'], 
      default: 'EN_ATTENTE' 
    },
    commentaire: { type: String, default: '' },
    dateAvis: { type: Date, default: Date.now }
  },

  // Décision finale d'orientation du Chef d'établissement / Principal
  decisionChefEtablissement: {
    voieRetenue: { 
      type: String, 
      enum: ['2NDE_GT', '2NDE_PRO', 'CAP', 'APPRENTISSAGE', 'AUTRE', 'EN_ATTENTE'], 
      default: 'EN_ATTENTE' 
    },
    accordFamille: { type: Boolean, default: false },
    dateDecision: { type: Date }
  },

  // Suivi des entretiens d'orientation individuels
  entretienOrientation: {
    realise: { type: Boolean, default: false },
    dateEntretien: { type: Date },
    compteRendu: { type: String, default: '' }
  }
}, { timestamps: true });

orientationSchema.index({ schoolKey: 1, eleveId: 1, annee: 1 }, { unique: true });

let model;
if (!mongoose.modelNames().includes("Orientation3eme")) {
  model = mongoose.model('Orientation3eme', orientationSchema);
} else {
  model = mongoose.model("Orientation3eme");
}

module.exports = model;

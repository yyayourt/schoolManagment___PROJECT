const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const dnbSimulationSchema = new Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true },
  annee: { type: String, required: true, default: '2023-2024' },

  // Épreuves finales du brevet (400 points)
  epreuves: {
    francais: { type: Number, min: 0, max: 100, default: 0 },
    mathematiques: { type: Number, min: 0, max: 100, default: 0 },
    histoireGeo: { type: Number, min: 0, max: 50, default: 0 },
    sciences: { type: Number, min: 0, max: 50, default: 0 },
    oral: { type: Number, min: 0, max: 100, default: 0 },
    optionBonus: { type: Number, min: 0, max: 20, default: 0 } // Bonus Latin/Option
  },

  ptsSocleCustom: { type: Number, min: 0, max: 400, default: null }, // Si l'utilisateur surcharge les points du socle
  noteFinalCalculated: { type: Number, default: 0 },
  mentionEstimee: { 
    type: String, 
    enum: ['REFUSE', 'ADMIS', 'ASSEZ_BIEN', 'BIEN', 'TRES_BIEN'], 
    default: 'REFUSE' 
  },

  commentaires: { type: String, default: '' }
}, { timestamps: true });

dnbSimulationSchema.index({ schoolKey: 1, eleveId: 1, annee: 1 }, { unique: true });

let model;
if (!mongoose.modelNames().includes("DnbSimulation")) {
  model = mongoose.model('DnbSimulation', dnbSimulationSchema);
} else {
  model = mongoose.model("DnbSimulation");
}

module.exports = model;

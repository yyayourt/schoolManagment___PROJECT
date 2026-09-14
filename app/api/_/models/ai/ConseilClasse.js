const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const conseilClasseSchema = new mongoose.Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  classeId: { type: ObjectId, ref: 'ai_Ecole_St_Martin', required: true },
  trimestre: { type: Number, enum: [1, 2, 3], required: true },
  annee: { type: String, required: true }, // ex: "2023-2024"
  
  dateConseil: { type: Date, required: true, default: Date.now },
  presents: [{ type: ObjectId, ref: 'ai_Profs_Ecole_St_Martin' }], // Enseignants présents
  
  decisions: [{
    eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true },
    
    // Décisions spécifiques du collège
    mention: { 
      type: String, 
      enum: [
        'FELICITATIONS', 'COMPLIMENTS', 'ENCOURAGEMENTS',
        'MISE_EN_GARDE_TRAVAIL', 'MISE_EN_GARDE_CONDUITE',
        'AVERTISSEMENT_TRAVAIL', 'AVERTISSEMENT_CONDUITE', 'AUCUNE'
      ], 
      default: 'AUCUNE' 
    },
    
    // Appréciation générale du Professeur Principal ou du Chef d'établissement
    appreciationGenerale: { type: String, default: "" },
    
    // Vœux d'orientation (essentiellement pour les 3ème, parfois 4ème)
    orientationAvis: { type: String, default: "" } 
  }],
  
  compteRendu: { type: String, default: "" } // Bilan global de la classe
}, { timestamps: true });

// S'assurer qu'il n'y a qu'un seul conseil par trimestre/année/classe
conseilClasseSchema.index({ classeId: 1, annee: 1, trimestre: 1 }, { unique: true });

let model;

if (!mongoose.modelNames().includes("ai_Conseils_Ecole_St_Martin")) {
    model = mongoose.model('ai_Conseils_Ecole_St_Martin', conseilClasseSchema);
} else {
    model = mongoose.model("ai_Conseils_Ecole_St_Martin");
}

module.exports = model;

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const salleSchema = new mongoose.Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  nom: { type: String, required: true }, // "Salle 102", "Labo SVT"
  type: { 
    type: String, 
    enum: ['CLASSIQUE', 'LABO', 'INFORMATIQUE', 'SPORT', 'ARTS', 'CDI', 'PERMANENCE'],
    default: 'CLASSIQUE'
  },
  capacite: { type: Number, default: 30 },
  equipements: [{ type: String }],
  etage: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

let model;

if (!mongoose.modelNames().includes("ai_Salles_Ecole_St_Martin")) {
    model = mongoose.model('ai_Salles_Ecole_St_Martin', salleSchema);
} else {
    model = mongoose.model("ai_Salles_Ecole_St_Martin");
}

module.exports = model;

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const noteSchema = new mongoose.Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true },
  classeId: { type: ObjectId, ref: 'ai_Ecole_St_Martin', required: true },
  matiereId: { type: String, required: true }, // ID de la matière (référence dynamique)
  enseignantId: { type: ObjectId, ref: 'ai_Profs_Ecole_St_Martin', required: true },
  annee: { type: String, required: true }, // ex: "2023-2024"
  trimestre: { type: Number, enum: [1, 2, 3], required: true },
  
  devoirId: { type: String, required: true, index: true }, // Identifiant unique groupant toutes les notes de ce devoir
  
  // Valeur de la note
  note: { type: Number, min: 0, max: 20, required: true },
  sur: { type: Number, default: 20 },
  
  // Paramètres Collège
  typeDevoir: { type: String, enum: ['CC', 'DS', 'EX'], default: 'CC' }, // Contrôle Continu, Devoir Surveillé, Examen
  poids: { type: Number, default: 1 }, // Coefficient spécifique de ce devoir (indépendant du coeff de la matière)
  
  // Méta-données
  titre: { type: String, required: true }, // ex: "Chapitre 3 : Théorème de Thalès"
  dateEvaluation: { type: Date, default: Date.now },
  appreciation: { type: String, default: "" }, // Appréciation facultative pour ce devoir
  
}, { timestamps: true });

let model;

if (!mongoose.modelNames().includes("ai_Notes_Ecole_St_Martin")) {
    model = mongoose.model('ai_Notes_Ecole_St_Martin', noteSchema);
} else {
    model = mongoose.model("ai_Notes_Ecole_St_Martin");
}

module.exports = model;

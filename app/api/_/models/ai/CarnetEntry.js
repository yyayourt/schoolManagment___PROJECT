const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const carnetEntrySchema = new Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true, index: true },
  auteurId: { type: ObjectId, required: true },
  auteurRole: { 
    type: String, 
    enum: ['PROF', 'CPE', 'ADMIN', 'PARENT'], 
    default: 'PROF' 
  },
  
  type: { 
    type: String, 
    enum: ['OBSERVATION', 'INFORMATION', 'CONVOCATION', 'AUTORISATION', 'REPONSE_PARENT'], 
    default: 'OBSERVATION' 
  },
  
  titre: { type: String, required: true, default: 'Billet de carnet' },
  contenu: { type: String, required: true, trim: true },
  pieceJointe: { type: String, default: '' },
  
  luParParent: { type: Boolean, default: false },
  dateLecture: { type: Date },
  signatureParent: { type: Boolean, default: false },
  dateSignature: { type: Date },
  reponseParent: { type: String, default: '' }
}, { timestamps: true });

carnetEntrySchema.index({ eleveId: 1, createdAt: -1 });

let model;
if (!mongoose.modelNames().includes('ai_CarnetEntries_Ecole_St_Martin')) {
  model = mongoose.model('ai_CarnetEntries_Ecole_St_Martin', carnetEntrySchema);
} else {
  model = mongoose.model('ai_CarnetEntries_Ecole_St_Martin');
}

module.exports = model;

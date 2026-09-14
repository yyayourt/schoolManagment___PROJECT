const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const incidentSchema = new Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true, index: true },
  rapporteurId: { type: ObjectId, ref: 'ai_Profs_Ecole_St_Martin', required: true },
  cpeId: { type: ObjectId, ref: 'ai_Profs_Ecole_St_Martin' },
  classeId: { type: ObjectId, ref: 'ai_Ecole_St_Martin' },
  
  dateIncident: { type: Date, default: Date.now },
  description: { type: String, required: true, trim: true },
  gravite: { 
    type: String, 
    enum: ['FAIBLE', 'MOYENNE', 'GRAVE'], 
    default: 'FAIBLE' 
  },
  
  sanction: {
    type: { 
      type: String, 
      enum: ['AUCUNE', 'HEURE_DE_COLLE', 'AVERTISSEMENT', 'EXCLUSION_COURS', 'EXCLUSION_ETABLISSEMENT'], 
      default: 'AUCUNE' 
    },
    details: { type: String, default: '' },
    travailAFaire: { type: String, default: '' },
    dateSanction: { type: Date },
    estSigneParParent: { type: Boolean, default: false },
    dateSignature: { type: Date }
  }
}, { timestamps: true });

incidentSchema.index({ eleveId: 1, dateIncident: -1 });

let model;
if (!mongoose.modelNames().includes('ai_Incidents_Ecole_St_Martin')) {
  model = mongoose.model('ai_Incidents_Ecole_St_Martin', incidentSchema);
} else {
  model = mongoose.model('ai_Incidents_Ecole_St_Martin');
}

module.exports = model;

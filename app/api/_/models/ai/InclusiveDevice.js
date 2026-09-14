const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const deviceItemSchema = new Schema({
  type: {
    type: String,
    enum: ['PAP', 'PPRE', 'PAI', 'PPS'],
    required: true
  },
  statut: {
    type: String,
    enum: ['ACTIF', 'EN_REVISION', 'ARCHIVE'],
    default: 'ACTIF'
  },
  diagnostiqueOuMotif: { type: String, default: '' },
  amenagementsPedagogiques: [{ type: String }],
  referentOuAesh: { type: String, default: '' },
  notesConfidentielles: { type: String, default: '' },
  dateCreation: { type: Date, default: Date.now },
  dateRevision: { type: Date }
});

const inclusiveDeviceSchema = new Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true },
  annee: { type: String, required: true, default: '2023-2024' },
  devices: [deviceItemSchema]
}, { timestamps: true });

inclusiveDeviceSchema.index({ schoolKey: 1, eleveId: 1, annee: 1 }, { unique: true });

let model;
if (!mongoose.modelNames().includes("InclusiveDevice")) {
  model = mongoose.model('InclusiveDevice', inclusiveDeviceSchema);
} else {
  model = mongoose.model("InclusiveDevice");
}

module.exports = model;

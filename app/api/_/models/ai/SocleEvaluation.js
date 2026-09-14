const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const socleEvaluationSchema = new Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  eleveId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true },
  annee: { type: String, required: true },
  
  // D1_1, D1_2, D1_3, D1_4, D2, D3, D4, D5
  evaluations: {
    type: Map,
    of: { 
      type: String, 
      enum: ['INSUFFISANT', 'FRAGILE', 'SATISFAISANT', 'TRES_BON'] 
    },
    default: {}
  },
  
  appreciationGlobale: { type: String, default: '' },
  validePar: { type: String } // User / Prof ID
}, { timestamps: true });

socleEvaluationSchema.index({ schoolKey: 1, eleveId: 1, annee: 1 }, { unique: true });

let model;
if (!mongoose.modelNames().includes("SocleEvaluation")) {
  model = mongoose.model('SocleEvaluation', socleEvaluationSchema);
} else {
  model = mongoose.model("SocleEvaluation");
}

module.exports = model;

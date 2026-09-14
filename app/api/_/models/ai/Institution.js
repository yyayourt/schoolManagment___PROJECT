const mongoose = require('mongoose');

const institutionSchema = new mongoose.Schema({
  schoolKey: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  logo: { 
    type: String, 
    default: '/school/logo.webp' 
  },
  ownerClerkId: { 
    type: String, 
    default: null, 
    index: true 
  },
  isReal: { 
    type: Boolean, 
    default: false 
  },
  type: { 
    type: String, 
    enum: ['PRIMAIRE', 'COLLEGE', 'LYCEE', 'MIXTE'], 
    default: 'PRIMAIRE' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

let model;
if (!mongoose.modelNames().includes('Institution')) {
  model = mongoose.model('Institution', institutionSchema);
} else {
  model = mongoose.model('Institution');
}

module.exports = model;

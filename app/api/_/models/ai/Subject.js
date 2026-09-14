const mongoose = require('mongoose')
const Schema = mongoose.Schema;

// Supprimer complètement le modèle existant pour éviter les conflits de cache
if (mongoose.connection.models.Subject) {
  delete mongoose.connection.models.Subject
}
if (mongoose.models.Subject) {
  delete mongoose.models.Subject
}

const subjectSchema = new mongoose.Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },

  nom: { 
    type: String, 
    required: true, 
    trim: true
  },
  code: { 
    type: String, 
    required: true, 
    uppercase: true,
    maxlength: 6
  },
  couleur: { 
    type: String, 
    default: "#3498db",
    match: /^#[0-9A-F]{6}$/i
  },
  niveaux: {
    type: mongoose.Schema.Types.Mixed,
    default: false,
    validate: {
      validator: function(value) {
        // Soit false (matière générale), soit un array de classes
        if (value === false) return true;
        if (Array.isArray(value)) {
          const validClasses = ["CP", "CE1", "CE2", "CM1", "CM2"];
          return value.every(classe => validClasses.includes(classe));
        }
        return false;
      },
      message: 'niveaux doit être false (général) ou un array de classes valides'
    }
  },
  dureeDefaut: { 
    type: Number, 
    default: 60,
    min: 15,
    max: 240
  }, // minutes
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
})

// Index pour optimiser les requêtes
subjectSchema.index({ schoolKey: 1, code: 1 })
subjectSchema.index({ schoolKey: 1, nom: 1 })
subjectSchema.index({ niveaux: 1, isActive: 1 })

// Créer le modèle avec un nom unique pour éviter les conflits de cache
let Subject

try {
  // Supprimer tous les modèles Subject existants
  const modelNames = ['Subject', 'SubjectV2', 'SubjectNew']
  modelNames.forEach(name => {
    if (mongoose.models[name]) {
      delete mongoose.models[name]
    }
    if (mongoose.connection.models[name]) {
      delete mongoose.connection.models[name]
    }
  })
  
  // Créer le modèle avec le nouveau schéma
  Subject = mongoose.model('Subject', subjectSchema)
  console.log('✅ Modèle Subject créé avec le nouveau schéma Mixed pour niveaux')
  
} catch (error) {
  console.error('❌ Erreur lors de la création du modèle Subject:', error)
  console.error('Détails:', error.message)
  throw error
}

module.exports = Subject

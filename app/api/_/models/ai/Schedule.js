const mongoose = require('mongoose')
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

// Schéma pour un créneau horaire
const timeSlotSchema = mongoose.Schema({
  heureDebut: { 
    type: String, 
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  }, // "08:00"
  heureFin: { 
    type: String, 
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  }, // "09:00"
  subjectId: { 
    type: ObjectId, 
    ref: 'Subject',
    required: true
  },
  notes: { 
    type: String,
    maxlength: 200
  } // commentaires spéciaux
}, { _id: false })

// Schéma d'un événement (nouveau modèle, cf. refonte EDT).
// Remplace la rigidité de `planning.{jour}[]` par une liste plate et flexible :
// horaires libres, jours non figés, et types (cours / pause / événement).
const eventSchema = mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 }, // 0 = dimanche, 1 = lundi…
  startTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }, // "08:15"
  endTime: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }, // "09:10"
  type: { type: String, enum: ['COURSE', 'BREAK', 'CUSTOM_EVENT'], default: 'COURSE' },
  subjectId: { type: ObjectId, ref: 'Subject', required: false, default: null }, // requis si type COURSE
  teacherId: { type: String, required: false, default: null }, // assignation directe éventuelle
  salleId: { type: ObjectId, ref: 'ai_Salles_Ecole_St_Martin', required: false, default: null },
  salleNom: { type: String, required: false, default: '' },
  label: { type: String, maxlength: 120 }, // libellé libre (pause, événement)
  notes: { type: String, maxlength: 200 },
}, { _id: false })

// Schéma principal pour l'emploi du temps
const scheduleSchema = mongoose.Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },
  classeId: {
    type: ObjectId,
    ref: 'ai_Ecole_St_Martin',
    required: true
  },
  label: {
    type: String,
    required: true,
    default: function() {
      // Auto-généré : "Emploi du temps - 24/08/2025"
      return `Emploi du temps - ${new Date().toLocaleDateString('fr-FR')}`
    }
  },

  // Nouveau format canonique : liste plate d'événements.
  events: { type: [eventSchema], default: [] },

  // Document original uploadé (photo, scan, pdf). Tableau pour supporter plusieurs pages.
  mediaSourceUrls: { type: [String], default: [] },
  mediaUpdatedAt: { type: Date, default: null },

  // Période de validité (programmation à l'avance d'un EDT).
  // validUntil null = EDT par défaut courant.
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, default: null },

  // Structure hebdomadaire — HÉRITÉ (déprécié). Conservé optionnel pour ne pas
  // perdre les anciens documents : migré à la volée vers `events` en lecture.
  planning: {
    lundi: [timeSlotSchema],
    mardi: [timeSlotSchema],
    mercredi: [timeSlotSchema],
    jeudi: [timeSlotSchema],
    vendredi: [timeSlotSchema],
    samedi: [timeSlotSchema] // optionnel
  },

  // Métadonnées
  isArchived: { 
    type: Boolean, 
    default: false 
  },
  
  // Historique des modifications
  modifications: [{
    date: { 
      type: Date, 
      default: Date.now 
    },
    userId: { 
      type: String 
    }, // clerkId
    action: { 
      type: String,
      enum: ["created", "updated", "archived", "reactivated"]
    },
    details: { 
      type: Object 
    } // représentation simplifiée du planning
  }],
  
  createdBy: { 
    type: String, 
    required: true 
  }, // clerkId
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
})

// Index pour optimiser les requêtes
scheduleSchema.index({ classeId: 1, isArchived: 1, createdAt: -1 })
scheduleSchema.index({ createdBy: 1 })

// Middleware pour mettre à jour updatedAt
scheduleSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

let model

if (!mongoose.modelNames().includes("Schedule"))
    model = mongoose.model('Schedule', scheduleSchema)
else 
    model = mongoose.model("Schedule")

module.exports = model

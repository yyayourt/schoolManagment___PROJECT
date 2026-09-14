const mongoose = require('mongoose')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId

// S'assurer que le modèle AttendanceRecord est enregistré pour les `populate`
require('./AttendanceRecord')

// Collection `AttendanceEntry` : le statut d'un élève pour une session d'appel.
// On conserve `classId`/`date` dénormalisés depuis la session afin de calculer
// rapidement les statistiques d'un élève sans jointure.
const attendanceEntrySchema = mongoose.Schema({
  schoolKey: { type: String, required: true, default: 'ecole_st_martin', index: true },

  // Session d'appel parente
  recordId: { type: ObjectId, ref: 'ai_AttendanceRecords_Ecole_St_Martin', required: true },
  // Élève concerné
  studentId: { type: ObjectId, ref: 'ai_Eleves_Ecole_St_Martin', required: true },
  // Statut de présence
  status: {
    type: String,
    enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
    default: 'PRESENT',
    required: true,
  },
  // Motif optionnel saisi par le prof (ex: "A raté le bus")
  comment: { type: String, default: '', required: false, trim: true },
  // Justificatif parental et validation Vie Scolaire / CPE
  justification: {
    note: { type: String, default: '' },
    submittedAt: { type: Date },
    status: { type: String, enum: ['NONE', 'PENDING', 'ACCEPTED', 'REJECTED'], default: 'NONE' },
    validatedBy: { type: String, default: '' },
    validatedAt: { type: Date }
  },
  // Dénormalisés depuis la session (pour les stats élève)
  classId: { type: ObjectId, ref: 'ai_Ecole_St_Martin', required: false, default: null },
  date: { type: Date, required: false, default: null },
})

// Un seul statut par (session, élève) : les upserts de l'API en dépendent.
attendanceEntrySchema.index({ recordId: 1, studentId: 1 }, { unique: true })
// Statistiques d'un élève (le plus récent d'abord)
attendanceEntrySchema.index({ studentId: 1, date: -1 })

let model

if (!mongoose.modelNames().includes('ai_AttendanceEntries_Ecole_St_Martin'))
  model = mongoose.model('ai_AttendanceEntries_Ecole_St_Martin', attendanceEntrySchema)
else model = mongoose.model('ai_AttendanceEntries_Ecole_St_Martin')

module.exports = model

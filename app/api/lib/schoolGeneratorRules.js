/**
 * Règles PURES du générateur d'école (listes, bornes, validation du formulaire),
 * sans dépendance Mongoose, pour être testables unitairement (`npm run test:unit`).
 */

export const NIVEAUX_PAR_TYPE = {
  PRIMAIRE: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'],
  COLLEGE: ['6ème', '5ème', '4ème', '3ème'],
  LYCEE: ['2nde', '1ère', 'Terminale'],
}

export const LIMITES = {
  maxClassesParNiveau: 4,
  maxElevesParClasse: 35,
  maxEnseignants: 40,
  maxEleves: 600,
}

/** Âge d'entrée par niveau (pour des dates de naissance plausibles). */
export const AGE_PAR_NIVEAU = {
  CP: 6, CE1: 7, CE2: 8, CM1: 9, CM2: 10,
  '6ème': 11, '5ème': 12, '4ème': 13, '3ème': 14,
  '2nde': 15, '1ère': 16, Terminale: 17,
}

export const MATIERES_PRIMAIRE = [
  { nom: 'Mathématiques', code: 'MATH', couleur: '#e74c3c', coef: 4 },
  { nom: 'Français', code: 'FR', couleur: '#3498db', coef: 4 },
  { nom: 'Dictée', code: 'DICT', couleur: '#2980b9', coef: 2 },
  { nom: 'Éveil au milieu', code: 'EV', couleur: '#27ae60', coef: 2 },
  { nom: 'Anglais', code: 'ANG', couleur: '#9b59b6', coef: 1 },
  { nom: 'Éducation Physique', code: 'EPS', couleur: '#e67e22', coef: 1, duree: 90 },
  { nom: 'Arts Plastiques', code: 'ARTS', couleur: '#f1c40f', coef: 1 },
]

export const MATIERES_SECONDAIRE = [
  { nom: 'Mathématiques', code: 'MATH', couleur: '#e74c3c', coef: 4 },
  { nom: 'Français', code: 'FR', couleur: '#3498db', coef: 4 },
  { nom: 'Histoire-Géographie', code: 'HG', couleur: '#f39c12', coef: 3 },
  { nom: 'Anglais LV1', code: 'ANG', couleur: '#9b59b6', coef: 3 },
  { nom: 'Espagnol LV2', code: 'ESP', couleur: '#8e44ad', coef: 2 },
  { nom: 'Physique-Chimie', code: 'PC', couleur: '#2ecc71', coef: 2 },
  { nom: 'SVT', code: 'SVT', couleur: '#1abc9c', coef: 2 },
  { nom: 'Technologie', code: 'TECH', couleur: '#34495e', coef: 1 },
  { nom: 'EPS', code: 'EPS', couleur: '#e67e22', coef: 1, duree: 110 },
  { nom: 'Arts Plastiques', code: 'ARTS', couleur: '#f1c40f', coef: 1 },
  { nom: 'Musique', code: 'MUS', couleur: '#d35400', coef: 1 },
]

/** Année scolaire en cours au format « YYYY-YYYY » (bascule au 1er septembre). */
export function anneeScolaireCourante() {
  const now = new Date()
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}-${start + 1}`
}

/**
 * Valide et normalise le corps du formulaire. Lève une Error avec `status: 400`
 * si le contenu est incohérent.
 */
export function normaliserConfiguration(body = {}) {
  const fail = (msg) => { const e = new Error(msg); e.status = 400; throw e }

  const type = ['PRIMAIRE', 'COLLEGE', 'LYCEE'].includes(body.type) ? body.type : 'PRIMAIRE'
  const name = String(body.name || '').trim().slice(0, 80)
  const annee = /^\d{4}-\d{4}$/.test(body.annee || '') ? body.annee : anneeScolaireCourante()
  const niveauxValides = NIVEAUX_PAR_TYPE[type]

  const niveaux = (Array.isArray(body.niveaux) ? body.niveaux : [])
    .filter((n) => n && niveauxValides.includes(n.niveau))
    .map((n) => ({
      niveau: n.niveau,
      nbClasses: Math.min(LIMITES.maxClassesParNiveau, Math.max(1, parseInt(n.nbClasses, 10) || 1)),
      elevesParClasse: Math.min(LIMITES.maxElevesParClasse, Math.max(0, parseInt(n.elevesParClasse, 10) || 0)),
    }))

  if (niveaux.length === 0) fail('Sélectionnez au moins un niveau.')

  const nbClassesTotal = niveaux.reduce((s, n) => s + n.nbClasses, 0)
  const nbElevesTotal = niveaux.reduce((s, n) => s + n.nbClasses * n.elevesParClasse, 0)
  if (nbElevesTotal > LIMITES.maxEleves) fail(`Effectif trop important (maximum ${LIMITES.maxEleves} élèves).`)

  const defautEnseignants = type === 'PRIMAIRE' ? nbClassesTotal : Math.max(MATIERES_SECONDAIRE.length, Math.ceil(nbClassesTotal * 1.5))
  const nbEnseignants = Math.min(LIMITES.maxEnseignants, Math.max(1, parseInt(body.nbEnseignants, 10) || defautEnseignants))

  return {
    type, name, annee, niveaux, nbEnseignants,
    avecDonnees: Boolean(body.avecDonnees),
    nbClassesTotal, nbElevesTotal,
  }
}

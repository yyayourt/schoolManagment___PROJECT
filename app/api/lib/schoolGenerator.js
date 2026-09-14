import Institution from '../_/models/ai/Institution'
import SchoolSettings from '../_/models/ai/SchoolSettings'
import Classe from '../_/models/ai/Classe'
import Eleve from '../_/models/ai/Eleve'
import Teacher from '../_/models/ai/Teacher'
import Subject from '../_/models/ai/Subject'
import { generateStudentNotes } from '../admin/reset-demo/lib/academicSeeder'
import { generateScheduleForClass } from '../admin/reset-demo/lib/scheduleSeeder'
import { MATIERES_PRIMAIRE, MATIERES_SECONDAIRE, AGE_PAR_NIVEAU, NIVEAUX_PAR_TYPE, LIMITES, anneeScolaireCourante, normaliserConfiguration } from './schoolGeneratorRules'

export { NIVEAUX_PAR_TYPE, LIMITES, anneeScolaireCourante, normaliserConfiguration }

/**
 * Générateur d'école « via formulaire ».
 *
 * Sert deux usages :
 *   - la création d'une école bac à sable depuis la landing (`POST /api/sandbox/create`),
 *   - le peuplement d'une école existante depuis l'administration (`POST /api/school_ai/generate`).
 *
 * Le formulaire décrit la structure (type d'établissement, niveaux, nombre de
 * classes par niveau, effectif par classe, nombre d'enseignants). Le générateur
 * crée l'Institution et ses paramètres si besoin, les matières, les enseignants,
 * les classes (corps enseignant + coefficients pour le secondaire) et les élèves.
 * Option `avecDonnees` : notes du trimestre et emploi du temps par classe.
 */

const NOMS = [
  'Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent',
  'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard',
  'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Lefevre', 'Faure', 'Andre',
  'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Chevalier', 'Francois', 'Legrand', 'Gauthier', 'Garcia',
  'Perrin', 'Robin', 'Clement', 'Morin', 'Nicolas', 'Henry', 'Roussel', 'Mathieu', 'Gautier', 'Masson',
  'Diallo', 'Traoré', 'Koné', 'Ouattara', 'Bamba', 'Touré', 'Coulibaly', 'Kouassi', 'N\'Guessan', 'Yao',
]
const PRENOMS_M = [
  'Lucas', 'Hugo', 'Arthur', 'Louis', 'Raphaël', 'Jules', 'Maël', 'Gabriel', 'Adam', 'Noah',
  'Léo', 'Paul', 'Nathan', 'Sacha', 'Tom', 'Mohamed', 'Ethan', 'Eden', 'Isaac', 'Amir',
  'Yanis', 'Ibrahim', 'Aboubacar', 'Moussa', 'Souleymane', 'Karim', 'Rayan', 'Malik', 'Enzo', 'Timéo',
]
const PRENOMS_F = [
  'Emma', 'Jade', 'Louise', 'Alice', 'Chloé', 'Lina', 'Léa', 'Rose', 'Anna', 'Mila',
  'Ambre', 'Julia', 'Inès', 'Léna', 'Manon', 'Zoé', 'Sarah', 'Fatoumata', 'Aïcha', 'Mariam',
  'Awa', 'Nour', 'Lucie', 'Camille', 'Eva', 'Romane', 'Agathe', 'Victoria', 'Adèle', 'Salomé',
]
const VILLES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nantes', 'Bordeaux', 'Lille', 'Abidjan', 'Dakar', 'Bamako']
const RUES = ['Rue des Écoles', 'Avenue de la République', 'Boulevard Victor Hugo', 'Rue Pasteur', 'Allée des Tilleuls', 'Rue Jean Moulin']

const pick = (arr, i) => arr[i % arr.length]
const rand = (n) => Math.floor(Math.random() * n)
const pad = (n) => String(n).padStart(2, '0')

function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
}

function naissancePourNiveau(niveau, annee) {
  const age = AGE_PAR_NIVEAU[niveau] || 10
  const startYear = parseInt(String(annee).split('-')[0], 10) || new Date().getFullYear()
  const year = startYear - age
  return `${year}-${pad(1 + rand(12))}-${pad(1 + rand(28))}`
}

function adresseAleatoire() {
  return `${1 + rand(120)} ${pick(RUES, rand(RUES.length))}, ${pick(VILLES, rand(VILLES.length))}`
}

async function assurerMatieres(schoolKey, type) {
  const defs = type === 'PRIMAIRE' ? MATIERES_PRIMAIRE : MATIERES_SECONDAIRE
  const subjects = []
  for (const def of defs) {
    const sub = await Subject.findOneAndUpdate(
      { schoolKey, code: def.code },
      { $setOnInsert: { schoolKey, code: def.code, nom: def.nom, couleur: def.couleur, dureeDefaut: def.duree || 55, niveaux: false, isActive: true } },
      { upsert: true, new: true }
    )
    subjects.push({ doc: sub, coef: def.coef })
  }
  return subjects
}

function parametresParDefaut(schoolKey, name, type) {
  const secondaire = type !== 'PRIMAIRE'
  return new SchoolSettings({
    schoolKey,
    feeDefinitions: [
      { id: 'scol', label: 'Scolarité', unit: '€', targets: [{ key: 'all', label: 'Base', amount: secondaire ? 350 : 250 }] },
      { id: 'cantine', label: 'Cantine', unit: '€', targets: [
        { key: 'doRegime', label: 'Demi-pensionnaire', amount: 120 },
        { key: 'doRegime', label: 'Externe', amount: 0 },
      ] },
    ],
    targets: [
      { key: 'all', options: ['Base'] },
      { key: 'doRegime', options: ['Demi-pensionnaire', 'Externe'] },
    ],
    homepage: {
      title: name,
      texts: [
        'Bienvenue sur le portail de votre établissement.',
        'Cette école a été générée automatiquement : explorez les classes, les élèves et les enseignants, puis personnalisez-la depuis l\'administration.',
      ],
      photo: '/school/classe.webp',
    },
  })
}

/**
 * Génère la structure d'une école dans le tenant courant.
 *
 * @param {ReturnType<typeof normaliserConfiguration>} config
 * @param {{ schoolKey: string, ownerClerkId?: string|null, isReal?: boolean, createdBy?: string }} ctx
 * @returns {Promise<{ schoolKey, name, counts: { classes, eleves, enseignants, matieres } }>}
 */
export async function genererEcole(config, { schoolKey, ownerClerkId = null, isReal = false, createdBy = 'generator' }) {
  const { type, annee, niveaux, nbEnseignants, avecDonnees } = config

  // 1. Institution + paramètres (créés seulement s'ils n'existent pas)
  let inst = await Institution.findOne({ schoolKey })
  if (!inst) {
    inst = new Institution({ schoolKey, name: config.name || 'Nouvel Établissement', type, isReal, ownerClerkId })
    await inst.save()
  } else if (inst.type !== type && !isReal) {
    inst.type = type
    await inst.save()
  }
  const name = inst.name

  if (!(await SchoolSettings.exists({ schoolKey }))) {
    await parametresParDefaut(schoolKey, name, type).save()
  }

  // 2. Matières
  const matieres = await assurerMatieres(schoolKey, type)
  const subjects = matieres.map((m) => m.doc)
  const coefParSubjectId = Object.fromEntries(matieres.map((m) => [m.doc._id.toString(), m.coef]))

  // 3. Enseignants
  const offset = rand(NOMS.length)
  const teachers = []
  for (let i = 0; i < nbEnseignants; i++) {
    const sexe = i % 2 === 0 ? 'M' : 'F'
    const prenom = sexe === 'M' ? pick(PRENOMS_M, offset + i) : pick(PRENOMS_F, offset + i)
    const nom = pick(NOMS, offset + i * 3)
    const t = new Teacher({
      schoolKey, nom, prenoms: [prenom], sexe,
      naissance_$_date: new Date(1965 + rand(30), rand(12), 1 + rand(28)).getTime(),
      adresse_$_map: adresseAleatoire(),
      phone_$_tel: `+336${String(10000000 + rand(89999999))}`,
      email_$_email: `${slugify(prenom)}.${slugify(nom)}@${slugify(name) || 'ecole'}.fr`,
      photo_$_file: '/school/prof.webp',
      current_classes: [],
    })
    await t.save()
    teachers.push(t)
  }

  // 4. Classes
  const classes = []
  let classIndex = 0
  for (const { niveau, nbClasses, elevesParClasse } of niveaux) {
    for (let c = 0; c < nbClasses; c++) {
      const alias = String.fromCharCode(65 + c) // A, B, C…
      const classe = new Classe({
        schoolKey, annee, niveau, alias,
        photo: '/school/classe.webp',
        moyenne_trimetriel: ['', '', ''],
        createdAt: (+new Date()).toString(),
      })

      if (type === 'PRIMAIRE') {
        const prof = pick(teachers, classIndex)
        classe.professeur = [prof._id]
        classe.profPrincipalId = prof._id
        classe.coefficients = coefParSubjectId
      } else {
        const corps = subjects.map((sub, idx) => ({
          enseignantId: pick(teachers, idx + classIndex)._id,
          matiereId: sub._id,
        }))
        classe.corpsEnseignant = corps
        classe.profPrincipalId = corps[classIndex % corps.length].enseignantId
        classe.professeur = [...new Set(corps.map((c) => c.enseignantId.toString()))]
        classe.coefficients = coefParSubjectId
      }

      await classe.save()
      classes.push({ doc: classe, elevesParClasse })
      classIndex++
    }
  }

  // Lier les enseignants à leurs classes (le hook post-save de Teacher complète `professeur`).
  for (const t of teachers) {
    const ids = classes
      .filter(({ doc }) => doc.professeur.some((p) => p.toString() === t._id.toString()))
      .map(({ doc }) => doc._id)
    if (ids.length) await Teacher.updateOne({ _id: t._id }, { $set: { current_classes: ids } })
  }

  // 5. Élèves (le hook post-save d'Eleve les ajoute dans `classe.eleves`).
  let nbEleves = 0
  const elevesParClasseDocs = new Map()
  for (const { doc: classe, elevesParClasse } of classes) {
    const docs = []
    for (let i = 0; i < elevesParClasse; i++) {
      const sexe = i % 2 === 0 ? 'M' : 'F'
      const nom = pick(NOMS, rand(NOMS.length))
      const prenom = sexe === 'M' ? pick(PRENOMS_M, rand(PRENOMS_M.length)) : pick(PRENOMS_F, rand(PRENOMS_F.length))
      const classeId = classe._id.toString()
      const eleve = new Eleve({
        schoolKey,
        current_classe: classe._id,
        nom, prenoms: [prenom], sexe,
        naissance_$_date: naissancePourNiveau(classe.niveau, annee),
        adresse_$_map: adresseAleatoire(),
        parents: {
          mere: `${pick(PRENOMS_F, rand(PRENOMS_F.length))} ${nom}`,
          pere: `${pick(PRENOMS_M, rand(PRENOMS_M.length))} ${nom}`,
          phone: `+336${String(10000000 + rand(89999999))}`,
          email: `famille.${slugify(nom)}${rand(999)}@exemple.fr`,
        },
        scolarity_fees_$_checkbox: { [annee]: rand(3) !== 0 },
        bolobi_class_history_$_ref_µ_classes: { [annee]: classeId },
        school_history: { [annee]: name },
        notes: { [annee]: {} },
        compositions: { [annee]: false },
      })
      // Profil scolaire utilisé par le générateur de notes.
      eleve.profileType = i % 3 === 0 ? 'EXCELLENT' : i % 3 === 1 ? 'MOYEN' : 'DIFFICULTES'
      await eleve.save()
      docs.push(eleve)
      nbEleves++
    }
    elevesParClasseDocs.set(classe._id.toString(), docs)
  }

  // 6. Données optionnelles : notes + emploi du temps
  if (avecDonnees) {
    for (const { doc: classe } of classes) {
      const eleves = elevesParClasseDocs.get(classe._id.toString()) || []
      if (eleves.length) await generateStudentNotes(classe, eleves, subjects, annee, schoolKey)
      const teacherId = classe.profPrincipalId || classe.professeur[0]
      const schedule = await generateScheduleForClass(classe, subjects, schoolKey, teacherId, createdBy, annee)
      if (schedule) {
        await Classe.updateOne({ _id: classe._id }, { $addToSet: { schedules: schedule._id }, $set: { currentScheduleId: schedule._id } })
      }
    }
  }

  return {
    schoolKey,
    name,
    counts: { classes: classes.length, eleves: nbEleves, enseignants: teachers.length, matieres: subjects.length },
  }
}

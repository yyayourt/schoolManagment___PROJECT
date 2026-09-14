# 🎓 Spécifications Techniques — Transition vers le Collège (Middle School)

Ce document formalise les spécifications techniques et fonctionnelles pour faire évoluer l'ERP scolaire (actuellement conçu pour le Primaire) vers le **Collège**. Il est structuré en couches d'implémentation progressives.

---

# PARTIE I — FONDATIONS

## 1. Vue d'Ensemble : Primaire vs Collège

| Fonctionnalité | Primaire (Actuel) | Collège (Cible) |
| :--- | :--- | :--- |
| **Enseignement** | Un maître unique par classe | Corps professoral pluridisciplinaire |
| **Évaluation** | Notes simples, coefficients optionnels | CC/DS/EX pondérés, coefficients par matière, socle commun de compétences |
| **Périodicité** | Trimestres simples | Trimestres stricts, conseil de classe, bulletin avec min/max/rang/appréciations |
| **Emploi du temps** | Fixe, centré sur la classe | Dynamique : enseignant × classe × salle, demi-groupes, options |
| **Vie scolaire** | Bons points, absences simples | CPE, absences/retards avec motifs, sanctions (colles, avertissements, exclusions) |
| **Autonomie élève** | Parent gère tout | Portails distincts : élève soumet devoirs, parent signe et paye |
| **Rôles** | admin, prof, parent, eleve | + CPE, surveillant, documentaliste, conseiller d'orientation, principal |

---

* Les composants React existants continuent de fonctionner pour les tenants `PRIMAIRE`.
* Les nouveaux modules ne s'affichent que si `type !== 'PRIMAIRE'`.

---

## 3. Nouveaux Rôles Utilisateurs (RBAC)

> **Prérequis :** Doit être implémenté en premier car toutes les sections suivantes référencent ces rôles.

| Rôle | Permissions clés |
|---|---|
| **CPE** (Conseiller Principal d'Éducation) | Absences/retards, justificatifs, sanctions, coordination surveillants |
| **Surveillant** | Appel en permanence, surveillance cantine, signalement d'incidents |
| **Documentaliste** | Gestion du CDI, prêts de livres |
| **Conseiller d'Orientation** | Fiches orientation 3èmes, suivi des vœux, RDV individuels |
| **Principal / Principal Adjoint** | Supervision générale, validation conseils de classe, décisions disciplinaires lourdes |

> **Impact technique :** Étendre `useUserRole`, `PermissionGate`, et le middleware Clerk.

---

# PARTIE II — INFRASTRUCTURE & DONNÉES

## 4. Évolution du Modèle de Données

### A. Schéma Classe (`Classe.js`)

La classe primaire a un tableau simple `professeur[]`. Au collège, il faut modéliser la liaison **Enseignant × Matière × Salle** et les **demi-groupes**.

```javascript
const classeSchema = new mongoose.Schema({
  schoolKey: { type: String, required: true, index: true },
  annee: { type: String, required: true },
  niveau: { type: String, required: true }, // "6ème", "5ème", "4ème", "3ème"
  alias: { type: String, required: true }, // "A", "B", "Euro"
  photo: { type: String, default: "/school/classe.webp" },
  
  // --- NOUVEAUTÉS COLLÈGE ---
  profPrincipalId: { type: ObjectId, ref: 'Teacher' },
  delegues: [{ type: ObjectId, ref: 'Eleve' }], // 2 titulaires + 2 suppléants
  
  corpsEnseignant: [{
    enseignantId: { type: ObjectId, ref: 'Teacher', required: true },
    matiereId: { type: ObjectId, ref: 'Subject', required: true },
    sallePrincipale: { type: String }
  }],

  coefficients: { type: Map, of: Number, default: {} },

  groupes: [{
    nom: { type: String, required: true }, // "Groupe A", "LV2 Allemand", "TP SVT 1"
    eleves: [{ type: ObjectId, ref: 'Eleve' }]
  }],

  // --- CHAMPS EXISTANTS CONSERVÉS ---
  eleves: { default: [], type: [ObjectId], ref: 'Eleve' },
  professeur: { default: [], type: [ObjectId], ref: 'Teacher' }, // Rétrocompat primaire
  history: { type: [Object], default: [] }
}, { timestamps: true });
```

### B. Gestion des Salles & Ressources

Nouveau modèle absent du primaire. Les salles sont référencées par l'emploi du temps et le système de détection de conflits.

```javascript
const salleSchema = new mongoose.Schema({
  schoolKey: { type: String, required: true, index: true },
  nom: { type: String, required: true }, // "Salle 102", "Labo SVT"
  type: { type: String, enum: ['CLASSIQUE', 'LABO', 'INFORMATIQUE', 'SPORT', 'ARTS', 'CDI', 'PERMANENCE'] },
  capacite: { type: Number, default: 30 },
  equipements: [{ type: String }],
  etage: { type: Number, default: 0 }
}, { timestamps: true });
```

| Type | Contrainte |
|---|---|
| Salle classique | Capacité 30-35, tableau + vidéoprojecteur |
| Laboratoire SVT/Physique | Capacité 18 (demi-groupe), matériel spécifique |
| Salle informatique | Capacité 20, postes numérotés |
| Gymnase / Terrain de sport | Partagé, réservation nécessaire |
| CDI | Capacité limitée, gestion par le documentaliste |

---

# PARTIE III — BLOC PÉDAGOGIQUE

## 5. Options, Langues Vivantes (LV1/LV2) & Groupes

Au collège, tous les élèves ne suivent pas le même cursus. Ce concept impacte directement l'emploi du temps (§6) et les évaluations (§7).

### A. Langues et Options
* **LV1 (6ème) :** Anglais, Allemand, Espagnol.
* **LV2 (5ème) :** Espagnol, Italien, Allemand.
* **Options (5ème/4ème) :** Latin, LCA, Section Sportive, Section Européenne.

### B. Impact sur les Groupes
L'emploi du temps doit supporter des **cours parallèles**. Ex. : mardi 14h–16h, la 4ème A est divisée :
* *Groupe LV2 Espagnol* → Salle 102
* *Groupe LV2 Allemand* → Salle 104
* *Groupe Latin* → Salle 201

Le champ `groupes[]` du schéma Classe (§4A) porte cette division. Un créneau de cours est lié soit à la classe entière, soit à un groupe spécifique.

---

## 6. Emploi du Temps & Détection de Conflits

Le planning du collège est contraint par 3 axes : **enseignant**, **salle**, **classe/groupe**.

### Algorithme de Détection de Conflits
```javascript
function verifierConflits(nouveauCours, coursExistants) {
  const conflits = [];
  for (const cours of coursExistants) {
    if (nouveauCours.jour !== cours.jour) continue;

    const chevauchement = Math.max(nouveauCours.heureDebutMin, cours.heureDebutMin) < 
                          Math.min(nouveauCours.heureFinMin, cours.heureFinMin);
    if (!chevauchement) continue;

    // Conflit enseignant
    if (String(nouveauCours.enseignantId) === String(cours.enseignantId))
      conflits.push({ type: "ENSEIGNANT", message: `Enseignant déjà en ${cours.classeNom}` });

    // Conflit salle
    if (nouveauCours.salle === cours.salle && nouveauCours.salle !== "EXTERIEUR")
      conflits.push({ type: "SALLE", message: `${nouveauCours.salle} déjà réservée` });

    // Conflit classe (sauf demi-groupes différents)
    if (String(nouveauCours.classeId) === String(cours.classeId)) {
      if (nouveauCours.groupeId && cours.groupeId && 
          String(nouveauCours.groupeId) !== String(cours.groupeId)) continue;
      conflits.push({ type: "CLASSE", message: "Classe déjà occupée sur ce créneau" });
    }
  }
  return { valide: conflits.length === 0, conflits };
}
```

---

## 7. Évaluations, Coefficients & Bulletins

### A. Typologie des Évaluations
| Type | Poids par défaut | Exemple |
|---|---|---|
| **CC** (Contrôle Continu) | 1 | Interrogation écrite, participation |
| **DS** (Devoir Surveillé) | 2 | Épreuve de fin de chapitre |
| **EX** (Examen Blanc) | 3 | Brevet Blanc (3ème) |

### B. Schéma de Note
```javascript
const noteSchema = new mongoose.Schema({
  eleveId: { type: ObjectId, ref: 'Eleve', required: true },
  classeId: { type: ObjectId, ref: 'Classe', required: true },
  matiereId: { type: ObjectId, ref: 'Subject', required: true },
  enseignantId: { type: ObjectId, ref: 'Teacher', required: true },
  trimestre: { type: Number, enum: [1, 2, 3], required: true },
  note: { type: Number, min: 0, max: 20, required: true },
  typeDevoir: { type: String, enum: ['CC', 'DS', 'EX'], default: 'CC' },
  poids: { type: Number, default: 1 },
  dateEvaluation: { type: Date, default: Date.now },
  appreciation: { type: String }
});
```

### C. Algorithme de Calcul
1. **Moyenne par matière :** $M_m = \frac{\sum(\text{Note}_i \times \text{Poids}_i)}{\sum \text{Poids}_i}$
2. **Moyenne générale :** $M_g = \frac{\sum(M_m \times \text{Coeff}_m)}{\sum \text{Coeff}_m}$
3. **Statistiques de classe par matière :** moyenne, min, max, médiane, rang de l'élève.

### D. Format du Bulletin Collège (PDF)
Pour chaque matière : Nom de l'enseignant | Moyenne élève | Moyenne classe | Min | Max | Rang | Appréciation individuelle. En bas : Moyenne générale, Mention du conseil de classe (§8), Appréciation du PP.

---

## 8. Conseil de Classe & Professeur Principal

### A. Professeur Principal (PP)
Rôle structuré absent du primaire :
* Coordonne le conseil de classe et rédige la synthèse.
* Rencontre les parents lors des réunions parents-profs.
* Pilote l'orientation (surtout en 3ème).
* Anime les **Heures de Vie de Classe**.

### B. Conseil de Classe (fin de trimestre)

| Mention | Condition typique |
|---|---|
| **Félicitations** | Moyenne ≥ 15, aucun avertissement conduite |
| **Compliments** | Moyenne ≥ 13, comportement satisfaisant |
| **Encouragements** | Progrès significatifs |
| **Mise en garde travail** | Résultats insuffisants |
| **Mise en garde conduite** | Comportement perturbateur |
| **Avertissement travail** | Résultats très insuffisants |
| **Avertissement conduite** | Incidents graves ou répétés |

```javascript
const conseilClasseSchema = new mongoose.Schema({
  classeId: { type: ObjectId, ref: 'Classe', required: true },
  trimestre: { type: Number, enum: [1, 2, 3], required: true },
  annee: { type: String, required: true },
  dateConseil: { type: Date, required: true },
  presents: [{ type: ObjectId, ref: 'Teacher' }],
  decisions: [{
    eleveId: { type: ObjectId, ref: 'Eleve', required: true },
    mention: { type: String, enum: [
      'FELICITATIONS', 'COMPLIMENTS', 'ENCOURAGEMENTS',
      'MISE_EN_GARDE_TRAVAIL', 'MISE_EN_GARDE_CONDUITE',
      'AVERTISSEMENT_TRAVAIL', 'AVERTISSEMENT_CONDUITE', 'AUCUNE'
    ], default: 'AUCUNE' },
    appreciationGenerale: { type: String },
    orientationAvis: { type: String } // 3èmes uniquement
  }],
  compteRendu: { type: String }
}, { timestamps: true });
```

---

## 9. Socle Commun de Compétences & DNB (Brevet)

### A. Évaluation par Compétences
En plus des notes/20, le collège évalue sur **8 domaines** :

| Domaine | Points max |
|---|---|
| D1.1 — Langue française | 50 |
| D1.2 — Langues étrangères | 50 |
| D1.3 — Langages mathématiques | 50 |
| D1.4 — Corps et arts | 50 |
| D2 — Méthodes et outils | 50 |
| D3 — Citoyen | 50 |
| D4 — Sciences et techniques | 50 |
| D5 — Représentations du monde | 50 |

4 niveaux : **Insuffisant (10 pts)**, **Fragile (25 pts)**, **Satisfaisant (40 pts)**, **Très bon (50 pts)**.

```javascript
const socleEvaluationSchema = new mongoose.Schema({
  eleveId: { type: ObjectId, ref: 'Eleve', required: true },
  annee: { type: String, required: true },
  evaluations: {
    type: Map,
    of: { type: String, enum: ['INSUFFISANT', 'FRAGILE', 'SATISFAISANT', 'TRES_BON'] }
  }
}, { timestamps: true });
```

### B. Brevet (DNB) — 800 points
* **Socle commun :** 400 pts (8 × 50).
* **Épreuves finales :** 400 pts (Français 100, Maths 100, Histoire-Géo 50, Sciences 50, Oral 100).
* Mentions : Assez Bien ≥ 480, Bien ≥ 560, Très Bien ≥ 640.

Le système doit offrir un **simulateur DNB** pour les élèves de 3ème.

---

## 10. Devoirs, Cahier de Texte & Rendu en Ligne

```javascript
const homeworkEntrySchema = new mongoose.Schema({
  schoolKey: { type: String, required: true, index: true },
  classeId: { type: ObjectId, ref: 'Classe', required: true },
  groupeId: { type: ObjectId }, // Optionnel (demi-groupe)
  enseignantId: { type: ObjectId, ref: 'Teacher', required: true },
  matiereId: { type: ObjectId, ref: 'Subject', required: true },
  titre: { type: String, required: true },
  description: { type: String },
  dateDonne: { type: Date, default: Date.now },
  dateRendu: { type: Date, required: true },
  renduEnLigne: { type: Boolean, default: false },
  fichiersJoints: [{ type: String }]
}, { timestamps: true });

const homeworkCompletionSchema = new mongoose.Schema({
  homeworkId: { type: ObjectId, ref: 'HomeworkEntry', required: true },
  eleveId: { type: ObjectId, ref: 'Eleve', required: true },
  status: { type: String, enum: ['NON_RENDU', 'RENDU', 'CORRIGE'], default: 'NON_RENDU' },
  fichiersRendus: [{ type: String }],
  dateSoumission: { type: Date },
  note: { type: Number },
  commentaireProf: { type: String }
}, { timestamps: true });
```

---

# PARTIE IV — VIE SCOLAIRE

## 11. Absences, Discipline & Sanctions

### A. Suivi des Absences et Retards
* Statut par défaut : `NON_JUSTIFIEE`.
* Le parent dépose un justificatif (texte/photo/PDF) depuis son espace.
* Le CPE valide → statut `JUSTIFIEE`.

### B. Module Discipline
```javascript
const incidentSchema = new mongoose.Schema({
  eleveId: { type: ObjectId, ref: 'Eleve', required: true },
  rapporteurId: { type: ObjectId, ref: 'Teacher', required: true },
  cpeId: { type: ObjectId },
  dateIncident: { type: Date, default: Date.now },
  description: { type: String, required: true },
  gravite: { type: String, enum: ['FAIBLE', 'MOYENNE', 'GRAVE'], default: 'FAIBLE' },
  sanction: {
    type: { type: String, enum: ['AUCUNE', 'HEURE_DE_COLLE', 'AVERTISSEMENT', 'EXCLUSION_COURS', 'EXCLUSION_ETABLISSEMENT'] },
    details: { type: String },
    travailAFaire: { type: String },
    dateSanction: { type: Date },
    estSigneParParent: { type: Boolean, default: false }
  }
}, { timestamps: true });
```

---

## 12. Étude Surveillée (Permanence)

Quand un élève a un trou dans son emploi du temps ou qu'un prof est absent :
* **Détection automatique** des créneaux libres d'un élève à partir de son emploi du temps.
* **Pointage par le surveillant** des présents en permanence.
* **Alerte** si un élève n'est ni en cours ni en permanence (absent non signalé).

---

## 13. Carnet de Correspondance Numérique

Canal quotidien école ↔ famille, remplace le carnet papier.

```javascript
const carnetEntrySchema = new mongoose.Schema({
  eleveId: { type: ObjectId, ref: 'Eleve', required: true },
  auteurId: { type: ObjectId, required: true },
  auteurRole: { type: String, enum: ['PROF', 'CPE', 'ADMIN', 'PARENT'] },
  type: { type: String, enum: ['OBSERVATION', 'INFORMATION', 'CONVOCATION', 'AUTORISATION', 'REPONSE_PARENT'] },
  contenu: { type: String, required: true },
  pieceJointe: { type: String },
  luParParent: { type: Boolean, default: false },
  dateLecture: { type: Date },
  signatureParent: { type: Boolean, default: false },
  reponseParent: { type: String }
}, { timestamps: true });
```

---

## 14. Stage d'Observation en Entreprise (3ème)

```javascript
const stageSchema = new mongoose.Schema({
  eleveId: { type: ObjectId, ref: 'Eleve', required: true },
  annee: { type: String, required: true },
  entreprise: {
    nom: { type: String, required: true },
    adresse: String, secteurActivite: String,
    tuteurNom: String, tuteurTel: String, tuteurEmail: String
  },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date, required: true },
  conventionSignee: { type: Boolean, default: false },
  conventionUrl: String,
  rapportRendu: { type: Boolean, default: false },
  rapportUrl: String,
  noteRapport: { type: Number, min: 0, max: 20 },
  noteSoutenance: { type: Number, min: 0, max: 20 },
  status: { type: String, enum: ['RECHERCHE', 'VALIDE', 'EN_COURS', 'TERMINE', 'EVALUE'], default: 'RECHERCHE' }
}, { timestamps: true });
```

---

## 15. Dispositifs d'Accompagnement Personnalisé

| Dispositif | Description | Responsable |
|---|---|---|
| **PPRE** | Difficulté scolaire passagère | PP + équipe pédagogique |
| **PAP** | Troubles apprentissages (dyslexie…) | Médecin scolaire + PP |
| **PAI** | Pathologie chronique (allergie…) | Médecin scolaire |
| **PPS** | Handicap reconnu (MDPH) | Référent handicap |

Chaque plan = document PDF archivé avec les aménagements accordés (tiers-temps, ordinateur, AVS…).

---

# PARTIE V — EXPÉRIENCE UTILISATEUR

## 16. Portails Élève & Parent

### A. Espace Élève
* **Dashboard :** Devoirs à rendre (compte à rebours), dernières notes, fil d'actualité par matière.
* **Cahier de texte :** Vue semaine. Clic sur un cours → télécharger le support PDF du prof.
* **Dépôt de devoirs :** Drag & drop (PDF, PNG, JPG, DOCX).
* **Messagerie :** Directe avec ses enseignants uniquement (pas inter-élèves).

### B. Espace Parent
* **Suivi :** Notes en temps réel, graphiques d'évolution par matière, moyennes de classe.
* **Signature numérique :** Valider la prise de connaissance d'un incident ou d'un bulletin.
* **Absences :** Justification en un clic + photo certificat médical.
* **Finances :** Échéances, reçus, paiement en ligne (Stripe/Mobile Money).

---

# PARTIE VI — ROADMAP D'IMPLÉMENTATION

| Phase | Contenu | Sections concernées |
|---|---|---|
| **Phase 1 — Fondations** | Feature flag `type`, niveaux collège, RBAC étendu, schéma Classe avec `corpsEnseignant` | §2, §3, §4 |
| **Phase 2 — Évaluations** | Notes typées (CC/DS/EX), calcul pondéré, bulletin collège | §7, §10 |
| **Phase 3 — Vie Scolaire** | Absences détaillées, incidents/sanctions, carnet de correspondance | §11, §13 |
| **Phase 4 — Emploi du temps** | Conflits, salles, demi-groupes, permanence | §5, §6, §12 |
| **Phase 5 — Orientation & DNB** | Socle commun, simulateur brevet, stage 3ème, conseil de classe | §8, §9, §14 |
| **Phase 6 — Portails** | UX élève autonome, UX parent avec signature numérique | §16 |
// Calcul des moyennes pour les bulletins scolaires.
// Fonctions pures, partagées entre l'API (gel du bulletin) et le client (aperçu + PDF).
//
// Le projet stocke les notes selon DEUX formats coexistants :
//   1. `eleve.compositions[année]` = tableau de trimestres
//        [{ officiel: { timestamp: { matièreId: { note, sur } } }, unOfficiel: {…} }, …]
//      → notes officielles par trimestre, avec dénominateur `sur` (coefficient dérivé).
//   2. `eleve.notes[année]` = { matièreNom: { libellé: valeur(/20) } }
//      → format « falsy »/simple, sans dimension trimestre, valeurs implicitement sur 20.
//
// On privilégie le format 1 (officiel, trimestriel). À défaut, on retombe sur le format 2.
// Coefficient dérivé du dénominateur `sur` (identique à NotesBlock).
function coefFromSur(sur) {
  let c = sur === 20 ? 2 : (sur >= 10 ? sur / 10 : sur);
  if (!c || c <= 0) c = 1;
  return c;
}

// Libellé de période -> indices de trimestres (format compositions).
export function periodToIndices(period) {
  switch (period) {
    case 'TRIMESTRE_1': return [0];
    case 'TRIMESTRE_2': return [1];
    case 'TRIMESTRE_3': return [2];
    case 'ANNUEL': return [0, 1, 2];
    default: return [0, 1, 2];
  }
}

export const PERIOD_LABELS = {
  TRIMESTRE_1: 'Trimestre 1',
  TRIMESTRE_2: 'Trimestre 2',
  TRIMESTRE_3: 'Trimestre 3',
  ANNUEL: 'Bilan annuel',
};

function finalize(subjects, source) {
  let wSum = 0;
  let wTot = 0;
  subjects.forEach((s) => { wSum += s.average * s.coef; wTot += s.coef; });
  const general = wTot ? wSum / wTot : null;
  return { subjects, general, source };
}

// Format 1 : compositions officielles, agrégées sur les trimestres demandés.
function fromCompositions(eleve, year, indices) {
  const comp = eleve?.compositions?.[year];
  if (!Array.isArray(comp)) return null;

  const per = {}; // matièreKey -> { sum20, count, sur }
  indices.forEach((i) => {
    const tri = comp[i];
    if (!tri || typeof tri !== 'object' || !tri.officiel) return;
    Object.values(tri.officiel).forEach((subjects) => {
      Object.entries(subjects || {}).forEach(([key, nd]) => {
        if (!nd || typeof nd !== 'object') return;
        const sur = nd.sur || 20;
        const note = Number(nd.note);
        if (!Number.isFinite(note)) return;
        if (!per[key]) per[key] = { sum20: 0, count: 0, sur };
        per[key].sum20 += (note / sur) * 20;
        per[key].count += 1;
        per[key].sur = sur;
      });
    });
  });

  const keys = Object.keys(per);
  if (!keys.length) return null;
  const subjects = keys.map((key) => ({
    key,
    name: null, // résolu plus tard via la collection Subject (clé = ObjectId)
    average: per[key].sum20 / per[key].count,
    coef: coefFromSur(per[key].sur),
    count: per[key].count,
  }));
  return finalize(subjects, 'compositions');
}

// Format 2 : notes simples par nom de matière (valeurs sur 20).
function fromNotes(eleve, year) {
  const notes = eleve?.notes?.[year];
  if (!notes || typeof notes !== 'object') return null;

  const subjects = [];
  Object.entries(notes).forEach(([name, evals]) => {
    if (!evals || typeof evals !== 'object') return;
    const vals = Object.values(evals).map(Number).filter(Number.isFinite);
    if (!vals.length) return;
    // Format simple : aucune information de coefficient → pondération égale (coef 1),
    // pour éviter une pondération arbitraire selon l'orthographe du nom de matière.
    subjects.push({
      key: name,
      name,
      average: vals.reduce((a, b) => a + b, 0) / vals.length,
      coef: 1,
      count: vals.length,
    });
  });
  if (!subjects.length) return null;
  return finalize(subjects, 'notes');
}

// Bulletin d'un élève : moyennes par matière (/20) + moyenne générale (/20).
export function computeStudentReport(eleve, year, period) {
  const indices = periodToIndices(period);
  return (
    fromCompositions(eleve, year, indices) ||
    fromNotes(eleve, year) ||
    { subjects: [], general: null, source: 'none' }
  );
}

// Synthèse de classe : bulletins individuels + stats par matière + classement.
export function computeClassReport(eleves, year, period) {
  const perStudent = eleves.map((e) => ({
    studentId: String(e._id),
    ...computeStudentReport(e, year, period),
  }));

  const subjStats = {}; // key -> { name, sum, count, min, max }
  perStudent.forEach((ps) => {
    ps.subjects.forEach((s) => {
      if (!subjStats[s.key]) {
        subjStats[s.key] = { name: s.name, sum: 0, count: 0, min: Infinity, max: -Infinity };
      }
      const st = subjStats[s.key];
      st.sum += s.average;
      st.count += 1;
      st.min = Math.min(st.min, s.average);
      st.max = Math.max(st.max, s.average);
      if (!st.name && s.name) st.name = s.name;
    });
  });

  const classSubjects = {};
  Object.entries(subjStats).forEach(([k, st]) => {
    classSubjects[k] = {
      name: st.name,
      average: st.count ? st.sum / st.count : null,
      min: st.min === Infinity ? null : st.min,
      max: st.max === -Infinity ? null : st.max,
      count: st.count,
    };
  });

  const withGen = perStudent.filter((p) => p.general !== null);
  const classGeneral = withGen.length
    ? withGen.reduce((a, p) => a + p.general, 0) / withGen.length
    : null;

  const ranked = [...withGen].sort((a, b) => b.general - a.general);
  const rank = {};
  ranked.forEach((p, i) => { rank[p.studentId] = i + 1; });

  return { perStudent, classSubjects, classGeneral, classSize: ranked.length, rank };
}

// Mention selon la moyenne générale /20 (bulletin officiel).
export function mention(general) {
  if (general == null) return '';
  if (general >= 16) return 'Félicitations';
  if (general >= 14) return 'Compliments';
  if (general >= 12) return 'Encouragements';
  if (general >= 10) return 'Assez bien';
  return 'Doit travailler davantage';
}

// NOUVEAU MOTEUR (Collège) - Calcul basé sur le modèle Note.js
export function computeClassReportFromNotes(eleves, notes, classCoefficients = {}) {
  // 1. Regrouper les notes par élève puis par matière
  const elevesNotes = {};
  eleves.forEach(e => {
    elevesNotes[e._id] = {};
  });

  notes.forEach(n => {
    const eId = String(n.eleveId);
    const mId = String(n.matiereId);
    if (!elevesNotes[eId]) elevesNotes[eId] = {};
    if (!elevesNotes[eId][mId]) elevesNotes[eId][mId] = [];
    elevesNotes[eId][mId].push(n);
  });

  const defaultCoeffMatiere = parseInt(process.env.NEXT_PUBLIC_SUBJECT_COEFF || '2');

  // 2. Calculer les moyennes par élève
  const perStudent = eleves.map(eleve => {
    const eId = String(eleve._id);
    const studentSubjects = elevesNotes[eId] || {};
    
    const subjects = [];
    let sumGen = 0;
    let totCoeffGen = 0;

    Object.entries(studentSubjects).forEach(([matiereId, matiereNotes]) => {
      let sumNotes = 0;
      let totPoids = 0;

      matiereNotes.forEach(noteObj => {
        const valSur20 = (noteObj.note / (noteObj.sur || 20)) * 20;
        const poids = noteObj.poids || (noteObj.typeDevoir === 'DS' ? 2 : noteObj.typeDevoir === 'EX' ? 3 : 1);
        
        sumNotes += valSur20 * poids;
        totPoids += poids;
      });

      if (totPoids > 0) {
        const average = sumNotes / totPoids;
        // Obtenir le coefficient de la matière pour la classe
        const coeffMatiere = classCoefficients[matiereId] !== undefined ? classCoefficients[matiereId] : defaultCoeffMatiere;
        
        subjects.push({
          key: matiereId,
          name: null, // Sera résolu plus tard
          average: average,
          coef: coeffMatiere,
          count: matiereNotes.length
        });

        sumGen += average * coeffMatiere;
        totCoeffGen += coeffMatiere;
      }
    });

    const general = totCoeffGen > 0 ? sumGen / totCoeffGen : null;

    return {
      studentId: eId,
      subjects,
      general,
      source: 'NoteModel'
    };
  });

  // 3. Calculer les statistiques de la classe
  const subjStats = {}; 
  perStudent.forEach(ps => {
    ps.subjects.forEach(s => {
      if (!subjStats[s.key]) {
        subjStats[s.key] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
      }
      const st = subjStats[s.key];
      st.sum += s.average;
      st.count += 1;
      st.min = Math.min(st.min, s.average);
      st.max = Math.max(st.max, s.average);
    });
  });

  const classSubjects = {};
  Object.entries(subjStats).forEach(([k, st]) => {
    classSubjects[k] = {
      average: st.count ? st.sum / st.count : null,
      min: st.min === Infinity ? null : st.min,
      max: st.max === -Infinity ? null : st.max,
      count: st.count,
    };
  });

  const withGen = perStudent.filter((p) => p.general !== null);
  const classGeneral = withGen.length
    ? withGen.reduce((a, p) => a + p.general, 0) / withGen.length
    : null;

  const ranked = [...withGen].sort((a, b) => b.general - a.general);
  const rank = {};
  ranked.forEach((p, i) => { rank[p.studentId] = i + 1; });

  return { perStudent, classSubjects, classGeneral, classSize: ranked.length, rank };
}

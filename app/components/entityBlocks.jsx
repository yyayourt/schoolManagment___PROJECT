"use client";
import React, { useState, useEffect, useContext, Fragment } from 'react';
import { AiAdminContext } from '../../stores/ai_adminContext';
import { COEFFICIENTS_MATIERES } from '../../utils/matieres';

function Parent({ form, setForm, parents }) {

  return <div className="parents-block">
    <div className="parent-card">
      <img src="/mom.webp" alt="Mère" className="parent-img" />
      <div className="parent-title">Mère</div>
      <label htmlFor="input-mere">Nom de la mère</label>
      <input id="input-mere" name="parents.mere" value={form?.parents?.mere || parents?.mere || ''} readOnly={setForm ? false : true} onChange={setForm ? e => setForm(f => ({ ...f, parents: { ...f.parents, mere: e.target.value } })) : null} placeholder="Nom de la mère" />
      <label htmlFor="input-phone">Téléphone parent</label>
      <input id="input-phone" name="parents.phone" value={form?.parents?.phone || parents?.phone || ''} readOnly={setForm ? false : true} onChange={setForm ? e => setForm(f => ({ ...f, parents: { ...f.parents, phone: e.target.value } })) : null} placeholder="Téléphone parent" />
    </div>
    <div className="parent-card">
      <img src="/pa.webp" alt="Père" className="parent-img" />
      <div className="parent-title">Père</div>
      <label htmlFor="input-pere">Nom du père</label>
      <input id="input-pere" name="parents.pere" value={form?.parents?.pere || parents?.pere || ''} readOnly={setForm ? false : true} onChange={setForm ? e => setForm(f => ({ ...f, parents: { ...f.parents, pere: e.target.value } })) : null} placeholder="Nom du père" />
    </div>
  </div>
}


// --- Bloc de gestion des commentaires professeur ---
function CommentairesBlock({ commentaires, setForm }) {
  const [newComment, setNewComment] = useState('');
  // Format attendu : [{timestamp: commentaire}, ...]
  // Tri du plus récent au plus ancien
  const items = Array.isArray(commentaires) ? commentaires : [];
  const cleanItems = items.map(obj => {
    if (!obj || typeof obj !== 'object') return {};
    const clean = {};
    Object.keys(obj).forEach(k => {
      if (k !== '_id') clean[k] = obj[k];
    });
    return clean;
  }).filter(obj => Object.keys(obj).length > 0);

  const sorted = cleanItems.sort((a, b) => {
    const ka = Object.keys(a)[0];
    const kb = Object.keys(b)[0];
    return Number(kb) - Number(ka);
  });

  // Fonction pour ajouter un commentaire
  const handleAdd = () => {
    if (!newComment.trim()) return;
    const timestamp = Date.now().toString();
    const newCommentObj = { [timestamp]: newComment.trim() };
    const updatedCommentaires = [...items, newCommentObj];
    setForm(f => ({ ...f, commentaires: updatedCommentaires }));
    setNewComment('');
  };

  // Fonction pour supprimer un commentaire
  const handleRemove = (index) => {
    const updatedCommentaires = items.filter((_, i) => i !== index);
    setForm(f => ({ ...f, commentaires: updatedCommentaires }));
  };

  // Si pas de setForm, read-only : juste affichage
  if (!setForm) {
    return (
      <div className="commentaires-block">
        <div className="commentaires-block__header">Commentaires du professeur</div>
        <div className="commentaires-block__list">
          {sorted.length === 0 && <span className="commentaires-block__empty">Aucun commentaire</span>}
          {sorted.map((obj, idx) => {
            const ts = Object.keys(obj)[0];
            const txt = obj[ts];
            return (
              <div key={ts} className="commentaires-block__item">
                <span className="commentaires-block__date">{new Date(Number(ts)).toLocaleDateString()}</span>
                <span className="commentaires-block__txt">{txt}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Edition
  return (
    <div className="commentaires-block">
      <div className="commentaires-block__header">Commentaires du professeur</div>
      <div className="commentaires-block__list">
        {sorted.length === 0 && <span className="commentaires-block__empty">Aucun commentaire</span>}
        {sorted.map((obj, idx) => {
          const ts = Object.keys(obj)[0];
          const txt = obj[ts];
          return (
            <div className="commentaires-block__entry" key={ts}>
              <span className="commentaires-block__entry-date">{new Date(Number(ts)).toLocaleString('fr-FR')}</span>
              <span className="commentaires-block__entry-txt">{txt}</span>
              <button type="button" className="commentaires-block__remove-btn" title="Supprimer" onClick={() => handleRemove(idx)}>&times;</button>
            </div>
          );
        })}
      </div>
      <div className="commentaires-block__add-form">
        <input
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Ajouter un commentaire..."
        />
        <button type="button" className="add-entry-btn" onClick={handleAdd} disabled={!newComment.trim()}>Ajouter</button>
      </div>
    </div>
  );
}

// --- Bloc d'historique des écoles fréquentées ---
function SchoolHistoryBlock({ schoolHistory, onChange }) {
  // Récupérer l'année scolaire courante
  const now = new Date();
  const currentYearStart = (now.getMonth() + 1) < 7 ? now.getFullYear() - 1 : now.getFullYear();
  const currentYearStr = `${currentYearStart}-${currentYearStart + 1}`;
  // Générer les 10 années précédentes (hors année courante)
  const years = Array.from({ length: 10 }, (_, i) => {
    const start = currentYearStart - i - 1;
    return `${start}-${start + 1}`;
  });
  // Années déjà renseignées
  const usedYears = Object.keys(schoolHistory || {});
  // Années disponibles pour ajout
  const availableYears = years.filter(y => !usedYears.includes(y));
  // Formulaire d'ajout
  const [selectedYear, setSelectedYear] = useState(availableYears[0] || '');
  const [ecole, setEcole] = useState('');

  const handleAdd = () => {
    if (!selectedYear || !ecole.trim()) return;
    onChange({ ...schoolHistory, [selectedYear]: ecole.trim() });
    setEcole('');
    // Mettre à jour l'année sélectionnée après ajout
    const nextAvailable = availableYears.filter(y => y !== selectedYear)[0] || '';
    setSelectedYear(nextAvailable);
  };
  const handleRemove = (year) => {
    const newHist = { ...schoolHistory };
    delete newHist[year];
    onChange(newHist);
  };
  return (
    <div className="school-history-block">
      <div className="school-history-block__header">Historique des écoles fréquentées</div>
      <div className="school-history-block__list">
        {usedYears.length === 0 && <span className="school-history-block__empty">Aucune école enregistrée</span>}
        {usedYears.sort((a, b) => b.localeCompare(a)).map(y => (
          <div className="school-history-block__entry" key={y}>
            <span className="school-history-block__entry-year">{y}</span>
            <span className="school-history-block__entry-ecole">{schoolHistory[y]}</span>
            <button type="button" className="school-history-block__remove-btn" title="Supprimer" onClick={() => handleRemove(y)}>×</button>
          </div>
        ))}
      </div>
      {onChange && <><div className="school-history-block__add-form">
        <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <input
          type="text"
          value={ecole}
          onChange={e => setEcole(e.target.value)}
          placeholder="Nom de l'école"
        />
        <button type="button" className="add-entry-btn" onClick={handleAdd} disabled={!selectedYear || !ecole.trim()}>Ajouter</button>
      </div>
        <input type="hidden" name="school_history" value={(() => {
          const now = new Date();
          const currentYearStart = (now.getMonth() + 1) < 7 ? now.getFullYear() - 1 : now.getFullYear();
          const currentYearStr = `${currentYearStart}-${currentYearStart + 1}`;
          return JSON.stringify({
            [currentYearStr]: "Martin de Porrès de Bolobi",
            ...(schoolHistory || {})
          });
        })()} /></>}
    </div>
  );
}

// --- Bloc de gestion des frais de scolarité par année ---
function ScolarityFeesBlock({ fees, onChange, schoolYear, targetsList = {} }) {
  const { feeDefinitions, normalizeFeeItem, resolveTargetAmount } = useContext(AiAdminContext);
  const [showForm, setShowForm] = useState(false);
  const [selectedFeeId, setSelectedFeeId] = useState(feeDefinitions[0]?.id || '');
  const [val, setVal] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const migratedFees = (fees) => {
    if (!fees || typeof fees !== 'object') return {};
    const migrated = {};
    Object.entries(fees).forEach(([ts, value]) => {
      migrated[ts] = Array.isArray(value) ? value : [value];
    });
    return migrated;
  };

  const processedFees = migratedFees(fees);

  // Normalize all entries to { feeId, amount, timestamp }
  const entries = Object.entries(processedFees).flatMap(([ts, deposits]) =>
    deposits.map((d, i) => ({ ...normalizeFeeItem(d), ts, index: i }))
  ).filter(e => e !== null);

  const handleAdd = () => {
    if (!val || isNaN(Number(val)) || Number(val) <= 0 || !selectedFeeId) return;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const ts = d.getTime();

    const newDeposit = {
      feeId: selectedFeeId,
      amount: Number(val),
      timestamp: Date.now()
    };

    const existingDeposits = processedFees[ts] || [];
    const updatedFees = {
      ...processedFees,
      [ts]: [...existingDeposits, newDeposit]
    };

    onChange(updatedFees);
    setShowForm(false);
    setVal('');
    setDate(new Date().toISOString().slice(0, 10));
  };

  const handleRemove = (ts, index) => {
    const updatedFees = { ...processedFees };
    if (updatedFees[ts]?.length > 1) {
      updatedFees[ts] = updatedFees[ts].filter((_, i) => i !== index);
    } else {
      delete updatedFees[ts];
    }
    onChange(updatedFees);
  };

  // Check if all fee types have reached their target
  const isGlobalComplete = feeDefinitions.every(def => {
    const total = entries.filter(e => e.feeId === def.id).reduce((sum, e) => sum + e.amount, 0);
    const target = resolveTargetAmount(def, targetsList);
    return total >= target;
  });

  return (
    <div className={`scolarity-fees-block ${isGlobalComplete ? 'scolarity-fees-block--complete' : 'scolarity-fees-block--incomplete'}`}>
      <div className="scolarity-fees-block__header">
        Frais de scolarité – {schoolYear}
      </div>

      <div className="scolarity-fees-block__totals">
        {feeDefinitions.map(def => {
          const total = entries.filter(e => e.feeId === def.id).reduce((sum, e) => sum + e.amount, 0);
          const target = resolveTargetAmount(def, targetsList);

          return (
            <div key={def.id} className="scolarity-fees-block__stat">
              {def.label} : <b>{total} {def.unit}</b> / {target} {def.unit}
            </div>
          );
        })}
      </div>

      <div className="scolarity-fees-block__list">
        {entries.length === 0 && <span className="scolarity-fees-block__empty">Aucun dépôt enregistré</span>}
        {entries.sort((a, b) => Number(a.ts) - Number(b.ts)).map((e, idx) => {
          const def = feeDefinitions.find(d => d.id === e.feeId);
          return (
            <div className="scolarity-fees-block__entry" key={`${e.ts}-${e.index}-${idx}`}>
              <span className="scolarity-fees-block__entry-date">{new Date(Number(e.ts)).toLocaleDateString()}</span>
              <span className="scolarity-fees-block__entry-value">{e.amount} {def?.unit || ''}</span>
              <span className="scolarity-fees-block__entry-label">({def?.label || e.feeId})</span>
              <span className="scolarity-fees-block__entry-time">
                {e.timestamp ? new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
              <button type="button" className="scolarity-fees-block__remove-btn" onClick={() => handleRemove(e.ts, e.index)}>×</button>
            </div>
          );
        })}
      </div>

      {showForm ? (
        <div className="scolarity-fees-block__add-form">
          <select
            value={selectedFeeId}
            onChange={e => setSelectedFeeId(e.target.value)}
            className="scolarity-fees-block__type-select"
          >
            {feeDefinitions.map(def => <option key={def.id} value={def.id}>{def.label}</option>)}
          </select>
          <input
            type="number"
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="Valeur"
            autoFocus
          />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <button type="button" className="add-entry-btn" onClick={handleAdd}>Valider</button>
          <button type="button" onClick={() => setShowForm(false)} className="entry-cancel-btn scolarity-fees-block__add-cancel">Annuler</button>
        </div>
      ) : (
        onChange && <button type="button" className="scolarity-fees-block__add-btn" onClick={() => setShowForm(true)}>Ajouter un dépôt</button>
      )}
      <input type="hidden" name="scolarity_fees_$_checkbox" value={JSON.stringify(fees)} />
    </div>
  );
}


function CoefficientsManager({ coefficients, onChange, subjectGroup, dynamicSubjects, subjectsLoaded }) {
  const defaultCoeff = parseInt(process.env.NEXT_PUBLIC_SUBJECT_COEFF || '2');

  // États pour l'interface de saisie
  const [selectedMatiere, setSelectedMatiere] = useState('');
  const [selectedCoefficient, setSelectedCoefficient] = useState('20');

  // Obtenir la liste des matières disponibles
  const getAvailableSubjects = () => {
    if (!subjectsLoaded) return [];
    return dynamicSubjects;
  };

  // Obtenir la liste des matières selon les indices pour l'affichage
  const getConfiguredSubjects = () => {
    if (!subjectsLoaded) return [];

    try {
      const indices = JSON.parse(subjectGroup);
      if (Array.isArray(indices)) {
        const availableSubjects = getAvailableSubjects();
        return indices.map((index, i) => ({
          index: index.toString(),
          name: availableSubjects[index]?.nom || `Matière ${index}`,
          displayIndex: i
        })).filter(subject => subject.name);
      }
    } catch (e) {
      // Fallback: traiter comme noms directs
      return subjectGroup.split(',').map((name, i) => ({
        index: i.toString(),
        name: name.trim(),
        displayIndex: i
      }));
    }
    return [];
  };

  const availableSubjects = getAvailableSubjects();
  const configuredSubjects = getConfiguredSubjects();

  // Initialiser la matière sélectionnée
  useEffect(() => {
    if (availableSubjects.length > 0 && !selectedMatiere) {
      setSelectedMatiere(availableSubjects[0]?.nom);
    }
  }, [availableSubjects, selectedMatiere]);

  const handleAddCoefficient = () => {
    if (!selectedMatiere) return;

    const subject = availableSubjects.find(s => s.nom === selectedMatiere);
    if (!subject) return;

    const newCoefficients = { ...coefficients };
    const coeffValue = Math.floor(parseInt(selectedCoefficient) / 10); // Convertir dénominateur en coefficient
    newCoefficients[subject.id] = coeffValue;
    onChange(newCoefficients);

    console.log('✅ Coefficient ajouté:', {
      matiere: selectedMatiere,
      id: subject.id,
      denominateur: selectedCoefficient,
      coefficient: coeffValue
    });
  };

  const handleRemoveCoefficient = (index) => {
    const newCoefficients = { ...coefficients };
    delete newCoefficients[index];
    onChange(newCoefficients);
  };

  const resetToDefault = () => {
    const defaultCoefficients = {};
    configuredSubjects.forEach(subject => {
      defaultCoefficients[subject.index] = defaultCoeff;
    });
    onChange(defaultCoefficients);
  };

  if (!subjectsLoaded) {
    return <div className="coefficients-manager__loading">Chargement des matières...</div>;
  }

  return (
    <div className="coefficients-manager">
      <div className="coefficients-manager__header">
        <h3>Configuration des coefficients par matière</h3>
        <button
          type="button"
          className="coefficients-manager__reset-btn"
          onClick={resetToDefault}
          title="Remettre tous les coefficients à la valeur par défaut"
        >
          Retirer l'élève du profil ({defaultCoeff})
        </button>
      </div>

      {/* Interface de saisie similaire aux notes d'élève */}
      <div className="compositions-block__add-form coefficients-manager__add-form">
        <select
          className="compositions-block__matiere-select"
          value={selectedMatiere}
          onChange={(e) => setSelectedMatiere(e.target.value)}
        >
          {availableSubjects.map(matiere => (
            <option key={matiere.id} value={matiere.nom}>{matiere.nom}</option>
          ))}
        </select>

        <select
          className="compositions-block__denominateur-select"
          value={selectedCoefficient}
          onChange={(e) => setSelectedCoefficient(e.target.value)}
        >
          <option value="10">10 (coeff 1)</option>
          <option value="20">20 (coeff 2)</option>
          <option value="30">30 (coeff 3)</option>
          <option value="40">40 (coeff 4)</option>
          <option value="50">50 (coeff 5)</option>
          <option value="100">100 (coeff 10)</option>
        </select>

        <button
          type="button"
          className="compositions-block__add-btn"
          onClick={handleAddCoefficient}
        >
          Configurer
        </button>
      </div>

      {/* Affichage des coefficients configurés */}
      <div className="coefficients-manager__configured">
        <h4>Coefficients configurés :</h4>
        {Object.keys(coefficients).length > 0 ? (
          <div className="coefficients-manager__list">
            {Object.entries(coefficients).map(([id, coeff]) => {
              const subject = availableSubjects.find(s => s.id === id);
              const subjectName = subject ? subject.nom : `ID: ${id}`;
              return (
                <div key={id} className="coefficients-manager__configured-item">
                  <span className="coefficients-manager__subject-name">{subjectName}</span>
                  <span className="coefficients-manager__coefficient">Coefficient {coeff} (sur {coeff * 10})</span>
                  <button
                    type="button"
                    className="coefficients-manager__remove-btn"
                    onClick={() => handleRemoveCoefficient(id)}
                    title="Supprimer ce coefficient"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="coefficients-manager__empty">Aucun coefficient configuré. Les valeurs par défaut seront utilisées.</p>
        )}
      </div>

      <div className="coefficients-manager__info">
        <p><strong>💡 Astuce :</strong> Le coefficient détermine l'importance de la matière dans le calcul des moyennes.</p>
        <p><strong>📊 Exemple :</strong> Coefficient 4 = la note compte 4 fois plus qu'une matière de coefficient 1.</p>
        <p><strong>🎯 Note :</strong> Le dénominateur (sur 20, sur 30, etc.) correspond au coefficient × 10.</p>
      </div>
    </div>
  );
}

// Fonction de migration de l'ancien format vers le nouveau
function migrateCompositionsFormat(oldCompositions) {
  if (!oldCompositions || typeof oldCompositions !== 'object') return {};

  const migratedCompositions = {};

  Object.entries(oldCompositions).forEach(([year, trimestres]) => {
    if (!Array.isArray(trimestres)) return;

    migratedCompositions[year] = trimestres.map(trimestreNotes => {
      if (!Array.isArray(trimestreNotes)) return { officiel: {}, unOfficiel: {} };

      const result = { officiel: {}, unOfficiel: {} };

      trimestreNotes.forEach(note => {
        if (typeof note !== 'object' || note === null) return;

        // Extraire les données de la note
        const [matiere, noteData] = Object.entries(note)[0] || [null, null];
        if (!matiere || !noteData) return;

        let noteValue, sur, date, officiel;

        if (typeof noteData === 'object' && noteData.note !== undefined) {
          // Nouveau format avec objet {note, sur, date, officiel}
          noteValue = noteData.note;
          sur = noteData.sur || 20;
          date = noteData.date;
          officiel = noteData.officiel !== undefined ? noteData.officiel : true;
        } else {
          // Ancien format avec juste la valeur numérique
          noteValue = noteData;
          sur = 20;
          date = new Date().toISOString().split('T')[0]; // Date par défaut
          officiel = true;
        }

        // Convertir la date en timestamp
        let timestamp;
        if (date) {
          timestamp = new Date(date).getTime().toString();
        } else {
          timestamp = Date.now().toString();
        }

        // Déterminer la catégorie (officiel/unOfficiel)
        const category = officiel ? 'officiel' : 'unOfficiel';

        // Initialiser le timestamp s'il n'existe pas
        if (!result[category][timestamp]) {
          result[category][timestamp] = {};
        }

        // Ajouter la note
        result[category][timestamp][matiere] = {
          note: noteValue,
          sur: sur
        };
      });

      return result;
    });
  });

  console.log('🔄 Migration des compositions terminée:', migratedCompositions);
  return migratedCompositions;
}

// Fonction utilitaire pour générer la liste des années scolaires
function generateSchoolYears(existingCompositions = {}) {
  const now = new Date();
  const currentYearStart = (now.getMonth() + 1) < 7 ? now.getFullYear() - 1 : now.getFullYear();

  // Génère la liste des années disponibles (de N-10 à N+10)
  const yearRange = Array.from({ length: 21 }, (_, i) => {
    const start = currentYearStart - 10 + i;
    return `${start}-${start + 1}`;
  });

  // Fusionne avec les années existantes dans les compositions
  const yearsSet = new Set([...yearRange, ...Object.keys(existingCompositions || {})]);
  const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

  return { years, currentYearStart };
}

// --- Bloc de gestion des compositions par trimestre ---
function CompositionsBlock({ compositions = {}, schoolYear, onChange, studentData, dynamicSubjects = [], subjectsLoaded, classCoefficients = {}, classes = [] }) {
  // Nouveau format : {"2025-2026": [{officiel: {timestamp: {matiere: {note, sur}}}, unOfficiel: {...}}, ...]}
  const [adding, setAdding] = useState(null); // trimestre en cours d'ajout
  const [newNote, setNewNote] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState('Mathématiques');
  const [selectedDenominateur, setSelectedDenominateur] = useState(COEFFICIENTS_MATIERES['Mathématiques'].toString());
  const [selectedDate, setSelectedDate] = useState('');
  const [isOfficiel, setIsOfficiel] = useState(true);
  const [editingNote, setEditingNote] = useState(null); // {trimestreIdx, category, timestamp, matiere, value}

  // Migration automatique si l'ancien format est détecté
  const [migratedCompositions, setMigratedCompositions] = useState(() => {
    // Détecter l'ancien format (array de notes directement)
    const yearData = compositions[schoolYear];
    if (Array.isArray(yearData) && yearData.length > 0) {
      const firstTrimestre = yearData[0];
      if (Array.isArray(firstTrimestre)) {
        // Ancien format détecté, migration nécessaire
        console.log('🔄 Ancien format détecté, migration en cours...');
        const migrated = migrateCompositionsFormat(compositions);
        // Note: onChange sera appelé dans useEffect après l'initialisation
        return migrated;
      }
    }
    return compositions;
  });

  // Effect pour sauvegarder la migration après l'initialisation
  useEffect(() => {
    if (onChange && migratedCompositions !== compositions) {
      console.log('💾 Sauvegarde de la migration...');
      onChange(migratedCompositions);
    }
  }, [migratedCompositions, onChange]);

  // Récupérer les compositions disponibles pour la classe de l'élève selon l'année sélectionnée
  const getAvailableCompositions = () => {
    if (!studentData?._id || !classes || classes.length === 0) return [];

    // Trouver la classe de l'élève pour l'année sélectionnée
    const eleveClasse = classes.find(classe =>
      classe.annee === schoolYear &&
      classe.eleves &&
      classe.eleves.includes(studentData._id)
    );

    if (!eleveClasse || !eleveClasse.compositions) return [];

    // Retourner les compositions triées par date
    return eleveClasse.compositions
      .map(([timestamp, officiel]) => ({
        timestamp,
        officiel,
        dateStr: new Date(timestamp).toLocaleDateString('fr-FR'),
        value: timestamp.toString()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  const availableCompositions = getAvailableCompositions();

  // Fonction pour valider qu'un timestamp existe dans les compositions de classe
  const validateTimestampWithClass = (timestamp) => {
    if (!classes || !Array.isArray(classes)) return false;

    // Trouver la classe de l'élève pour l'année scolaire sélectionnée
    const studentClass = classes.find(classe =>
      classe.annee === schoolYear &&
      classe.eleves &&
      classe.eleves.includes(studentData._id)
    );

    if (!studentClass || !studentClass.compositions || !Array.isArray(studentClass.compositions)) {
      return false;
    }

    // Vérifier si le timestamp existe dans les compositions de classe
    return studentClass.compositions.some(([classTimestamp]) =>
      classTimestamp.toString() === timestamp.toString()
    );
  };

  // Fonction pour obtenir le coefficient d'une matière (priorité: classe > hardcodé > défaut)
  const getCoefficientForSubject = (matiere) => {
    // 1. Chercher par ID ou Nom dans les coefficients de classe
    const subject = dynamicSubjects.find(s => s.nom === matiere || s.id === matiere || s._id === matiere);
    if (subject && classCoefficients[subject.id]) {
      return classCoefficients[subject.id] * 10; // coefficient * 10 = sur
    }

    // 2. Fallback sur coefficients hardcodés
    if (COEFFICIENTS_MATIERES[matiere]) {
      return COEFFICIENTS_MATIERES[matiere];
    }

    // 3. Valeur par défaut
    return parseInt(process.env.NEXT_PUBLIC_SUBJECT_COEFF || '2') * 10;
  };

  // Fonction pour gérer le changement de matière et ajuster automatiquement le dénominateur
  const handleMatiereChange = (matiere) => {
    setSelectedMatiere(matiere);
    // Ajuster automatiquement le dénominateur selon le coefficient de la matière
    const coefficient = getCoefficientForSubject(matiere);
    setSelectedDenominateur(coefficient.toString());

    console.log('🎯 Coefficient calculé pour', matiere, ':', {
      coefficient,
      source: classCoefficients[dynamicSubjects.find(s => s.nom === matiere)?.id] ? 'classe' : 'fallback'
    });
  };

  // États pour le formulaire de groupe
  const [showingGroupForm, setShowingGroupForm] = useState(null); // trimestre en cours de saisie groupée
  const [groupFormData, setGroupFormData] = useState({}); // {matiere: {note, sur, officiel}}
  const [groupCommonDate, setGroupCommonDate] = useState(''); // Date commune pour toutes les notes du groupe
  const [groupOfficielStatus, setGroupOfficielStatus] = useState(true); // Statut officiel/non-officiel pour le groupe



  const trimestres = ["1er trimestre", "2e trimestre", "3e trimestre"];

  // Génère la liste des années disponibles (utilise la fonction utilitaire)
  const { years, currentYearStart } = generateSchoolYears(migratedCompositions);
  // On récupère le tableau pour l'année courante avec la nouvelle structure
  const rawComps = migratedCompositions[schoolYear];
  const compoArr = Array.isArray(rawComps) && rawComps.length > 0 ? rawComps : [
    { officiel: {}, unOfficiel: {} },
    { officiel: {}, unOfficiel: {} },
    { officiel: {}, unOfficiel: {} }
  ];

  const getSubName = (idOrName) => {
    if (!idOrName) return 'Inconnue';
    if (!dynamicSubjects || dynamicSubjects.length === 0) return idOrName;

    const sub = dynamicSubjects.find(s =>
      s.id === idOrName ||
      s._id === idOrName ||
      s.nom === idOrName ||
      (s.id && s.id.toString() === idOrName.toString())
    );
    return sub ? sub.nom : idOrName;
  };

  // Fonction pour calculer la moyenne d'un trimestre avec la nouvelle structure
  const calculateTrimestreMoyenne = (trimestreData) => {
    if (!trimestreData || typeof trimestreData !== 'object') return null;

    let totalPoints = 0;
    let totalCoefficients = 0;

    // Parcourir les compositions officielles et non-officielles
    ['officiel', 'unOfficiel'].forEach(category => {
      const categoryData = trimestreData[category] || {};

      Object.values(categoryData).forEach(compositionNotes => {
        if (typeof compositionNotes !== 'object') return;

        Object.entries(compositionNotes).forEach(([matiere, noteData]) => {
          if (!noteData || typeof noteData !== 'object') return;

          const noteValue = noteData.note;
          const sur = noteData.sur || 20;

          // Déterminer le coefficient réel
          // Si sur=20, coeff=2. Sinon si sur>=10, coeff = sur/10. Sinon coeff = sur (ancien format de coeff direct)
          let coefficient = sur === 20 ? 2 : (sur >= 10 ? sur / 10 : sur);
          // Sécurité anti-zéro
          if (coefficient === 0) coefficient = 1;

          if (typeof noteValue === 'number' && typeof sur === 'number' && sur > 0 && noteValue >= 0) {
            // Note sur 10 : noteValue / sur * 10
            const noteSur10 = (noteValue / sur) * 10;

            totalPoints += noteSur10 * coefficient;
            totalCoefficients += coefficient;
          }
        });
      });
    });

    return totalCoefficients > 0 ? (totalPoints / totalCoefficients) : null;
  };

  // Calculer les moyennes trimestrielles
  const moyennesTrimestrielles = compoArr.map(trimestreNotes => calculateTrimestreMoyenne(trimestreNotes));

  // Calculer la moyenne annuelle
  const calculateMoyenneAnnuelle = () => {
    const moyennesValides = moyennesTrimestrielles.filter(moyenne => moyenne !== null);
    if (moyennesValides.length === 0) return null;
    return moyennesValides.reduce((sum, moyenne) => sum + moyenne, 0) / moyennesValides.length;
  };

  const moyenneAnnuelle = calculateMoyenneAnnuelle();

  const handleAdd = idx => {
    if (!onChange || newNote === '' || isNaN(Number(newNote)) || !selectedDate) return;

    const noteNum = Number(newNote);
    const denominateur = Number(selectedDenominateur);
    const timestamp = selectedDate; // selectedDate contient déjà le timestamp
    const category = isOfficiel ? 'officiel' : 'unOfficiel';

    // Validation: vérifier que le timestamp existe dans les compositions de classe
    if (!validateTimestampWithClass(timestamp)) {
      alert('Cette date de composition n\'existe pas dans la classe de l\'élève pour cette année scolaire.');
      return;
    }

    // Créer une copie de la structure actuelle
    const newCompoArr = [...compoArr];

    // S'assurer que le trimestre existe avec la bonne structure
    if (!newCompoArr[idx]) {
      newCompoArr[idx] = { officiel: {}, unOfficiel: {} };
    }

    // S'assurer que la catégorie existe
    if (!newCompoArr[idx][category]) {
      newCompoArr[idx][category] = {};
    }

    // S'assurer que le timestamp existe
    if (!newCompoArr[idx][category][timestamp]) {
      newCompoArr[idx][category][timestamp] = {};
    }

    // Ajouter la note
    newCompoArr[idx][category][timestamp][selectedMatiere] = {
      note: noteNum,
      sur: denominateur
    };

    // Sauvegarder avec la nouvelle structure
    const newCompositions = { ...migratedCompositions, [schoolYear]: newCompoArr };
    onChange(newCompositions);
    setMigratedCompositions(newCompositions);

    // Reset du formulaire
    setAdding(null);
    setNewNote('');
    setSelectedMatiere('Mathématiques');
    setSelectedDenominateur(COEFFICIENTS_MATIERES['Mathématiques'].toString());
    setSelectedDate('');
    setIsOfficiel(true);
  };

  // Fonction pour ouvrir le formulaire de groupe
  const handleCreateGroup = (idx) => {
    console.log('🔍 DEBUG - Ouverture du formulaire de groupe...');

    // NOUVEAU : Utiliser les IDs réellement configurés dans les coefficients de classe
    // au lieu de la variable d'environnement statique
    const configuredIds = classCoefficients && Object.keys(classCoefficients).length > 0
      ? Object.keys(classCoefficients)
      : null;

    // Fallback sur la variable d'environnement si pas de coefficients configurés
    const subjectGroup = process.env.NEXT_PUBLIC_SUBJECT_GROUP || '[0,1,2,3]';

    console.log('📊 État actuel:', {
      configuredIds,
      classCoefficients,
      subjectGroup,
      subjectsLoaded,
      dynamicSubjectsLength: dynamicSubjects.length,
      dynamicSubjects,
    });

    // Gérer le cas où on a des coefficients configurés ou utiliser la variable d'environnement
    let subjects = [];
    let indices;

    if (configuredIds && configuredIds.length > 0) {
      // PRIORITÉ : Utiliser les IDs des coefficients configurés
      const availableSubjects = dynamicSubjects;
      subjects = configuredIds.map(id => availableSubjects.find(s => s.id === id)?.nom).filter(Boolean);
      console.log('✅ Utilisation des IDs des coefficients configurés:', configuredIds);
    } else {
      // FALLBACK : Utiliser la variable d'environnement
      try {
        indices = JSON.parse(subjectGroup);
        console.log('⚠️ Fallback sur la variable d\'environnement:', indices);
      } catch (e) {
        indices = [0, 1, 2, 3]; // Fallback par défaut
        console.log('⚠️ Fallback par défaut:', indices);
      }
    }

    if (subjects.length === 0 && Array.isArray(indices) && dynamicSubjects.length > 0) {
      // Convertir les indices en noms de matières
      const availableSubjects = dynamicSubjects;
      subjects = indices.map(index => availableSubjects[index]?.nom).filter(Boolean);

      console.log('🎯 Conversion des indices:', {
        indices,
        availableSubjectsFirst6: availableSubjects.slice(0, 6),
        subjects,
        source: 'MongoDB',
        mongodbFirst4: dynamicSubjects.slice(0, 4),
      });
    } else if (subjects.length === 0 && dynamicSubjects.length > 0) {
      // Fallback si les indices ne sont pas un array
      subjects = [dynamicSubjects[0].nom];
      console.log('⚠️ Fallback sur première matière:', subjects);
    } else {
      console.log('⚠️ Aucune matière disponible.');
    }

    // Initialiser les données du formulaire de groupe
    const initialFormData = {};
    const defaultDate = new Date().toISOString().split('T')[0];

    subjects.forEach(matiere => {
      initialFormData[matiere] = {
        note: '',
        sur: getCoefficientForSubject(matiere)
      };
    });

    setGroupFormData(initialFormData);
    setGroupCommonDate(''); // Initialiser avec une date vide
    setGroupOfficielStatus(true); // Initialiser le statut
    setShowingGroupForm(idx);
    console.log('Formulaire de groupe initialisé:', { formData: initialFormData });
  };

  // Fonction pour valider le formulaire de groupe
  const handleValidateGroup = () => {
    // Vérifier que la date commune est renseignée
    if (!groupCommonDate) {
      alert('Veuillez sélectionner une date pour les compositions.');
      return;
    }

    const timestamp = groupCommonDate; // groupCommonDate contient déjà le timestamp

    // Validation: vérifier que le timestamp existe dans les compositions de classe
    if (!validateTimestampWithClass(timestamp)) {
      alert('Cette date de composition n\'existe pas dans la classe de l\'élève pour cette année scolaire.');
      return;
    }

    // Créer une copie de la structure actuelle
    const newCompoArr = [...compoArr];
    const idx = showingGroupForm;

    // S'assurer que le trimestre existe avec la bonne structure
    if (!newCompoArr[idx]) {
      newCompoArr[idx] = { officiel: {}, unOfficiel: {} };
    }

    // Traiter chaque matière du groupe
    Object.entries(groupFormData).forEach(([matiere, data]) => {
      const noteValue = parseFloat(data.note);
      if (isNaN(noteValue) || noteValue < 0) return; // Ignorer les notes invalides

      const category = groupOfficielStatus ? 'officiel' : 'unOfficiel';

      // S'assurer que la catégorie existe
      if (!newCompoArr[idx][category]) {
        newCompoArr[idx][category] = {};
      }

      // S'assurer que le timestamp existe
      if (!newCompoArr[idx][category][timestamp]) {
        newCompoArr[idx][category][timestamp] = {};
      }

      // Ajouter la note
      newCompoArr[idx][category][timestamp][matiere] = {
        note: noteValue,
        sur: data.sur
      };
    });

    // Sauvegarder avec la nouvelle structure
    const newCompositions = { ...migratedCompositions, [schoolYear]: newCompoArr };
    onChange(newCompositions);
    setMigratedCompositions(newCompositions);

    // Réinitialiser le formulaire
    setShowingGroupForm(null);
    setGroupFormData({});
    setGroupCommonDate(''); // Réinitialiser la date commune
    setGroupOfficielStatus(true); // Réinitialiser le statut

    alert(`Groupe de ${Object.keys(groupFormData).length} notes créé avec succès pour le ${groupCommonDate} !`);
  };

  // Fonction pour annuler le formulaire de groupe
  const handleCancelGroup = () => {
    setShowingGroupForm(null);
    setGroupFormData({});
    setGroupCommonDate(''); // Réinitialiser la date commune
  };

  // Fonction pour supprimer une note dans la nouvelle structure
  const handleRemoveNew = (trimestreIdx, category, timestamp, matiere) => {
    if (!onChange) return;

    const newCompoArr = [...compoArr];

    if (newCompoArr[trimestreIdx]?.[category]?.[timestamp]) {
      delete newCompoArr[trimestreIdx][category][timestamp][matiere];

      if (Object.keys(newCompoArr[trimestreIdx][category][timestamp]).length === 0) {
        delete newCompoArr[trimestreIdx][category][timestamp];
      }
    }

    const newCompositions = { ...migratedCompositions, [schoolYear]: newCompoArr };
    onChange(newCompositions);
    setMigratedCompositions(newCompositions);
  };

  // Fonction pour préparer la modification d'une note
  const handleEditNote = (trimestreIdx, category, timestamp, matiere, currentValue) => {
    setEditingNote({ trimestreIdx, category, timestamp, matiere, value: currentValue });
  };

  // Fonction pour enregistrer la note modifiée
  const handleSaveEdit = () => {
    if (!editingNote || !onChange) return;
    const { trimestreIdx, category, timestamp, matiere, value } = editingNote;
    const noteNum = parseFloat(value);

    if (isNaN(noteNum) || noteNum < 0) {
      alert('Veuillez saisir une note valide.');
      return;
    }

    const newCompoArr = [...compoArr];
    if (newCompoArr[trimestreIdx]?.[category]?.[timestamp]?.[matiere]) {
      newCompoArr[trimestreIdx][category][timestamp][matiere].note = noteNum;

      const newCompositions = { ...migratedCompositions, [schoolYear]: newCompoArr };
      onChange(newCompositions);
      setMigratedCompositions(newCompositions);
      setEditingNote(null);
    }
  };

  // Fonction pour supprimer un bloc entier de composition (toutes les notes d'une date)
  const handleRemoveComposition = (trimestreIdx, category, timestamp) => {
    if (!onChange) return;

    // Demander confirmation car l'action est destructrice
    if (!window.confirm('Voulez-vous vraiment supprimer toutes les notes de cette composition ?')) {
      return;
    }

    const newCompoArr = [...compoArr];

    if (newCompoArr[trimestreIdx] &&
      newCompoArr[trimestreIdx][category] &&
      newCompoArr[trimestreIdx][category][timestamp]) {

      delete newCompoArr[trimestreIdx][category][timestamp];
    }

    // Sauvegarder
    const newCompositions = { ...migratedCompositions, [schoolYear]: newCompoArr };
    onChange(newCompositions);
    setMigratedCompositions(newCompositions);
  };

  // Fonction pour mettre à jour une donnée du formulaire de groupe
  const updateGroupFormData = (matiere, field, value) => {
    setGroupFormData(prev => ({
      ...prev,
      [matiere]: {
        ...prev[matiere],
        [field]: value
      }
    }));
  };
  const handleRemove = (idx, nidx) => {
    if (!onChange) return;
    const newArr = compoArr.map((arr, i) => i === idx ? arr.filter((_, j) => j !== nidx) : arr);
    onChange({ ...compositions, [schoolYear]: newArr });
  };

  return (
    <div className="compositions-block">
      <div className="compositions-block__header">Compositions</div>

      {/* Moyenne annuelle */}
      <div className="compositions-block__moyenne-annuelle">
        <strong>Moyenne annuelle ({schoolYear}): </strong>
        <span>{moyenneAnnuelle !== null ? `${(moyenneAnnuelle * 2).toFixed(2)}/20` : 'Non calculée'}</span>
      </div>

      {trimestres.map((tri, idx) => (
        <div key={tri} className="compositions-block__trimestre">
          <div className="compositions-block__trimestre-header">
            <span className="compositions-block__trimestre-title">{tri}</span>
            <span className="compositions-block__trimestre-score">
              Moyenne trimestrielle: {moyennesTrimestrielles[idx] !== null ? `${moyennesTrimestrielles[idx].toFixed(2)}/10` : 'Non calculée'}
            </span>
            {onChange && (
              <div className="compositions-block__actions">
                <button
                  type="button"
                  className="compositions-block__add-btn"
                  onClick={() => {
                    setAdding(idx);
                    setNewNote('');
                    setSelectedDate(new Date().toISOString().split('T')[0]);
                  }}
                >Ajouter</button>

                <button
                  type="button"
                  className="compositions-block__createGroup-btn"
                  onClick={() => handleCreateGroup(idx)}
                  title="Créer un groupe de notes pour toutes les matières définies"
                >Créer groupe</button>
              </div>
            )}
          </div>
          <div className="compositions-block__notes">
            {compoArr[idx] && typeof compoArr[idx] === 'object' && (compoArr[idx].officiel || compoArr[idx].unOfficiel) ? (
              // Regrouper toutes les notes par timestamp (date)
              (() => {
                const notesByDate = {};

                // Collecter toutes les notes par timestamp
                Object.entries(compoArr[idx]).forEach(([category, timestamps]) => {
                  Object.entries(timestamps || {}).forEach(([timestamp, subjects]) => {
                    if (!notesByDate[timestamp]) {
                      notesByDate[timestamp] = {
                        date: new Date(parseInt(timestamp)),
                        isOfficiel: category === 'officiel',
                        notes: []
                      };
                    }

                    Object.entries(subjects || {}).forEach(([matiere, noteData]) => {
                      notesByDate[timestamp].notes.push({
                        matiere,
                        noteValue: noteData.note,
                        denominateur: noteData.sur || 20,
                        category
                      });
                    });
                  });
                });

                // Afficher les notes regroupées par date
                return Object.entries(notesByDate)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([timestamp, dateGroup]) => (
                    <div key={timestamp} className="compositions-block__notesDate">
                      <div className="compositions-block__notesDetails">
                        <span className="compositions-block__note-date">
                          {dateGroup.date.toLocaleDateString('fr-FR')}
                        </span>
                        <span className={`compositions-block__note-badge ${dateGroup.isOfficiel ? 'compositions-block__note-badge--officiel' : 'compositions-block__note-badge--non-officiel'}`}>
                          {dateGroup.isOfficiel ? 'Officiel' : 'Non officiel'}
                        </span>

                        {onChange && (
                          <button
                            type="button"
                            className="compositions-block__remove-comp-btn"
                            title="Supprimer toute la composition"
                            onClick={() => handleRemoveComposition(idx, dateGroup.notes[0]?.category, timestamp)}
                          >
                            ✕ Supprimer la composition
                          </button>
                        )}
                      </div>
                      {dateGroup.notes.map((note, noteIndex) => {
                        const isEditing = editingNote &&
                          editingNote.trimestreIdx === idx &&
                          editingNote.category === note.category &&
                          editingNote.timestamp === timestamp &&
                          editingNote.matiere === note.matiere;

                        return (
                          <div key={`${timestamp}-${note.matiere}`} className={`compositions-block__note ${isEditing ? 'compositions-block__note--editing' : ''}`}>
                            <span className="compositions-block__note-matiere">{getSubName(note.matiere)}:</span>

                            {isEditing ? (
                              <div className="compositions-block__edit-wrapper">
                                <input
                                  type="number"
                                  className="compositions-block__edit-input"
                                  value={editingNote.value}
                                  onChange={e => setEditingNote({ ...editingNote, value: e.target.value })}
                                  autoFocus
                                />
                                <span className="compositions-block__edit-sur">/{note.denominateur >= 10 ? note.denominateur : note.denominateur * 10}</span>
                                <button className="compositions-block__save-edit-btn" onClick={handleSaveEdit}>✓</button>
                                <button className="compositions-block__cancel-edit-btn" onClick={() => setEditingNote(null)}>✕</button>
                              </div>
                            ) : (
                              <>
                                <span className="compositions-block__note-value">
                                  {note.noteValue}/{note.denominateur >= 10 ? note.denominateur : note.denominateur * 10}
                                </span>
                                {onChange && (
                                  <div className="compositions-block__note-actions">
                                    <button
                                      type="button"
                                      className="compositions-block__edit-btn"
                                      title="Modifier la note"
                                      onClick={() => handleEditNote(idx, note.category, timestamp, note.matiere, note.noteValue)}
                                    >✎</button>
                                    <button
                                      type="button"
                                      className="compositions-block__remove-btn"
                                      title="Supprimer"
                                      onClick={() => handleRemoveNew(idx, note.category, timestamp, note.matiere)}
                                    >×</button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ));
              })()
            ) : (
              <span className="compositions-block__no-compo">Aucune composition</span>
            )}
            {adding === idx && (
              <div className="compositions-block__add-form">
                <select
                  className="compositions-block__date-input"
                  value={selectedDate}
                  onChange={e => {
                    setSelectedDate(e.target.value);
                    // Récupérer le statut officiel de la composition sélectionnée
                    const selectedCompo = availableCompositions.find(c => c.value === e.target.value);
                    if (selectedCompo) {
                      setIsOfficiel(selectedCompo.officiel);
                    }
                  }}
                  required
                >
                  <option value="">Sélectionnez une date de composition</option>
                  {availableCompositions.map(compo => (
                    <option key={compo.value} value={compo.value}>
                      {compo.dateStr} {compo.officiel ? '(Officiel)' : '(Non officiel)'}
                    </option>
                  ))}
                </select>

                <select
                  className="compositions-block__matiere-select"
                  value={selectedMatiere}
                  onChange={e => handleMatiereChange(e.target.value)}
                >
                  {dynamicSubjects.length > 0 ? dynamicSubjects.map(matiere => (
                    <option key={matiere.id} value={matiere.nom}>{matiere.nom}</option>
                  )) : (
                    <option value="" disabled>Aucune matière</option>
                  )}
                </select>

                <input
                  type="number"
                  min="0"
                  max={selectedDenominateur}
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Note"
                  className="compositions-block__note-input"
                  autoFocus
                />

                <span className="compositions-block__separator">/</span>

                <select
                  className="compositions-block__denominateur-select"
                  value={selectedDenominateur}
                  onChange={e => setSelectedDenominateur(e.target.value)}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="30">30</option>
                  <option value="40">40</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>

                <button
                  type="button"
                  className={`compositions-block__officiel-badge ${isOfficiel ? 'compositions-block__officiel-badge--active' : ''}`}
                  onClick={() => setIsOfficiel(!isOfficiel)}
                  title="Cliquer pour changer le type"
                >
                  {isOfficiel ? 'Officiel' : 'Non officiel'}
                </button>

                <button
                  type="button"
                  className="compositions-block__add-btn"
                  onClick={() => handleAdd(idx)}
                >Valider</button>

                <button
                  type="button"
                  className="compositions-block__add-btn compositions-block__add-btn--cancel"
                  onClick={() => {
                    setAdding(null);
                    setNewNote('');
                    setSelectedDate('');
                    setIsOfficiel(true);
                  }}
                >Annuler</button>
              </div>
            )}

            {/* Formulaire de groupe */}
            {showingGroupForm === idx && (
              <div className="compositions-block__group-form">
                <h4 className="compositions-block__group-title">Saisie groupée de notes</h4>

                {/* Date commune pour toutes les notes du groupe */}
                <div className="compositions-block__group-date">
                  <label className="compositions-block__group-date-label">
                    <strong>📅 Date de composition :</strong>
                  </label>
                  <select
                    className="compositions-block__date-input compositions-block__group-date-input"
                    value={groupCommonDate}
                    onChange={e => {
                      setGroupCommonDate(e.target.value);
                      // Mettre à jour automatiquement le statut officiel/non-officiel
                      const selectedCompo = availableCompositions.find(compo => compo.value === e.target.value);
                      if (selectedCompo) {
                        setGroupOfficielStatus(selectedCompo.officiel);
                      }
                    }}
                    required
                  >
                    <option value="">Sélectionnez une date de composition</option>
                    {availableCompositions.map(compo => (
                      <option key={compo.value} value={compo.value}>
                        {compo.dateStr} {compo.officiel ? '(Officiel)' : '(Non officiel)'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={`compositions-block__officiel-badge ${groupOfficielStatus ? 'compositions-block__officiel-badge--active' : ''}`}
                    disabled
                    title="Statut déterminé automatiquement par la date sélectionnée"
                  >
                    {groupOfficielStatus ? 'Officiel' : 'Non officiel'}
                  </button>
                </div>

                {Object.entries(groupFormData).map(([matiere, data]) => (
                  <div key={matiere} className="compositions-block__add-form">
                    <select
                      className="compositions-block__matiere-select"
                      value={matiere}
                      disabled
                    >
                      <option value={matiere}>{matiere}</option>
                    </select>

                    <input
                      type="number"
                      min="0"
                      max={data.sur}
                      value={data.note}
                      onChange={e => updateGroupFormData(matiere, 'note', e.target.value)}
                      placeholder="Note"
                      className="compositions-block__note-input"
                    />

                    <span className="compositions-block__separator">/</span>

                    <select
                      className="compositions-block__denominateur-select"
                      value={data.sur}
                      onChange={e => updateGroupFormData(matiere, 'sur', parseInt(e.target.value))}
                    >
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="30">30</option>
                      <option value="40">40</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>

                  </div>
                ))}

                <div className="compositions-block__group-actions">
                  <button
                    type="button"
                    className="compositions-block__add-btn"
                    onClick={handleValidateGroup}
                  >Valider tout</button>

                  <button
                    type="button"
                    className="compositions-block__add-btn compositions-block__add-btn--cancel"
                    onClick={handleCancelGroup}
                  >Annuler</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      {/* Champ caché pour la soumission */}
      <input type="hidden" name="compositions" value={JSON.stringify({ [schoolYear]: compoArr })} />
    </div>
  );
}

// Bloc gestion des absences (édition ou read-only)
// Bloc gestion des bonus (édition ou read-only)
// Bloc générique pour entrées horodatées (bonus / malus), édition ou lecture seule.
// BonusBlock et ManusBlock étaient deux copies de ce composant (~125 lignes chacune) :
// seuls le nom de champ, les libellés et les préfixes de classes CSS différaient.
// `valueless` (absences) : `entries` est un tableau de timestamps (number[]),
// sérialisé en CSV, sans champ « raison ». Sinon (bonus/malus) : objet/array {ts: raison}, en JSON.
function TimedEntriesBlock({ field, label, singular, entries, setForm, valueless = false }) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  // Normalisation en paires [ts, txt] pour un rendu commun.
  const items = valueless
    ? (Array.isArray(entries)
      ? entries.map(entry => {
          if (entry && typeof entry === 'object') {
            return [entry.date || entry.timestamp || '', ''];
          }
          return [entry || '', ''];
        }).filter(([ts]) => ts !== '')
      : [])
    : (entries && typeof entries === 'object'
      ? (Array.isArray(entries)
        ? entries.flatMap(obj => {
            if (obj && typeof obj === 'object') {
              return Object.entries(obj).filter(([k]) => k !== '_id');
            }
            return [];
          })
        : Object.entries(entries).filter(([k]) => k !== '_id'))
      : []);

  // Valeur de l'input caché : CSV de timestamps (valueless) ou JSON des raisons.
  const hiddenValue = valueless
    ? items.map(([ts]) => ts).join(',')
    : JSON.stringify(entries || {});

  // Groupement par mois (clé "YYYY-MM")
  const groupByMonth = (list) => list.reduce((acc, [ts, txt]) => {
    const d = new Date(Number(ts));
    const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push([ts, txt]);
    return acc;
  }, {});

  const addEntry = () => {
    if (!date || (!valueless && !reason)) return;
    const ts = new Date(date).setHours(0, 0, 0, 0);
    setForm(f => {
      const current = f[field] || [];
      if (valueless) {
        const arr = Array.isArray(current) ? current : [];
        return arr.includes(ts) ? f : { ...f, [field]: [...arr, ts] };
      }
      // Gérer les deux formats : array d'objets ou objet direct
      if (Array.isArray(current)) {
        return { ...f, [field]: [...current, { [ts]: reason }] };
      }
      const arr = Object.keys(current).length > 0
        ? [current, { [ts]: reason }]
        : [{ [ts]: reason }];
      return { ...f, [field]: arr };
    });
    setShowForm(false);
    setDate('');
    setReason('');
  };

  const removeEntry = (ts) => {
    if (!window.confirm(`Supprimer ce ${singular} ?`)) return;
    setForm(f => {
      const current = f[field] || [];
      if (valueless) {
        return { ...f, [field]: (Array.isArray(current) ? current : []).filter(x => x !== ts) };
      }
      if (Array.isArray(current)) {
        return { ...f, [field]: current.filter(obj => !obj.hasOwnProperty(ts)) };
      }
      const o = { ...current };
      delete o[ts];
      return { ...f, [field]: o };
    });
  };

  const renderMonths = (interactive) =>
    Object.entries(groupByMonth(items)).sort((a, b) => b[0].localeCompare(a[0])).map(([month, monthEntries]) => (
      <div key={month} className={`${field}-month`}>
        <div className="month-title">{new Date(Number(monthEntries[0][0])).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</div>
        <div className={`month-${field}`}>
          {monthEntries.sort((a, b) => Number(a[0]) - Number(b[0])).map(([ts, txt]) => (
            <div className={`${field}-entry`} key={ts} style={interactive ? { position: 'relative', display: 'inline-block', margin: '0 6px 6px 0' } : undefined}>
              <span className={interactive ? undefined : `${field}-date`}>{new Date(Number(ts)).toLocaleDateString('fr-FR')}</span>
              {!valueless && <span className={`${field}-txt`}>{typeof txt === 'string' ? txt : (typeof txt === 'object' ? Object.values(txt)[0] || JSON.stringify(txt) : String(txt))}</span>}
              {interactive && (
                <button type="button" className={`remove-${field}-btn`} title="Supprimer" onClick={() => removeEntry(ts)}>&times;</button>
              )}
            </div>
          ))}
        </div>
      </div>
    ));

  if (!setForm) {
    // Affichage lecture seule
    return (
      <div className={`${field}-block`}>
        <div className={`${field}-header`}>
          <span>{label} : <b>{items.length}</b></span>
        </div>
        <div className={`${field}-list`}>{renderMonths(false)}</div>
        <input type="hidden" name={field} value={hiddenValue} />
      </div>
    );
  }

  return (
    <div className={`${field}-block`}>
      <input type="hidden" name={field} value={hiddenValue} />
      <div className={`${field}-header`}>
        <span>{label} : <b>{items.length}</b></span>
        <button type="button" className={`add-${field}-btn`} onClick={() => setShowForm(true)}>Ajouter</button>
      </div>
      {showForm && (
        <div className={`${field}-picker-modal`}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          {!valueless && <input type="text" placeholder={`Raison du ${singular}`} value={reason} onChange={e => setReason(e.target.value)} />}
          <button type="button" className="add-entry-btn" onClick={addEntry}>Valider</button>
          <button type="button" className="entry-cancel-btn" onClick={() => setShowForm(false)}>Annuler</button>
        </div>
      )}
      <div className={`${field}-list`}>{renderMonths(true)}</div>
    </div>
  );
}

// Enveloppes fines : conservent l'API publique (réexportées depuis EntityModal).
function BonusBlock({ bonus, setForm }) {
  return <TimedEntriesBlock field="bonus" label="Bonus" singular="bonus" entries={bonus} setForm={setForm} />;
}

// Bloc gestion des malus (édition ou read-only)
function ManusBlock({ manus, setForm }) {
  return <TimedEntriesBlock field="manus" label="Malus" singular="malus" entries={manus} setForm={setForm} />;
}

// Bloc gestion des absences (timestamps sans raison) — réutilise TimedEntriesBlock en mode valueless
function AbsencesBlock({ absences, setForm }) {
  return <TimedEntriesBlock field="absences" label="Absences" singular="absence" entries={absences} setForm={setForm} valueless />;
}
// --- Composant pour ajouter une note ---
function AddNoteForm({ notes = {}, onAdd, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [matiere, setMatiere] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const handleValidate = () => {
    if (!date || !matiere || !note) {
      setErr('Tous les champs sont requis');
      return;
    }
    const timestamp = new Date(date).getTime();
    if (!timestamp || isNaN(timestamp)) {
      setErr('Date invalide');
      return;
    }
    if (onAdd) onAdd({ [timestamp]: [matiere, note] });
    setDate(''); setMatiere(''); setNote(''); setErr('');
    setShowForm(false);
  };

  const handleCancel = () => {
    setDate(''); setMatiere(''); setNote(''); setErr('');
    setShowForm(false);
  };

  return (
    <div className="notes-container" style={{ border: '1px solid #ccc', borderRadius: 6, padding: 8, marginBottom: 16 }}>
      {/* Affichage des notes triées par date croissante */}
      {Object.entries(notes)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([timestamp, [matiere, note]], idx) => (
          <div key={timestamp} style={{ display: 'flex', alignItems: 'center', background: '#f9f9f9', borderRadius: 4, marginBottom: 4, padding: 4, position: 'relative' }}>
            <span style={{ minWidth: 100, fontWeight: 500 }}>{new Date(Number(timestamp)).toLocaleDateString()}</span>
            <span style={{ margin: '0 12px' }}>{matiere}</span>
            <span style={{ margin: '0 12px', fontWeight: 600 }}>{note}</span>
            {onRemove && (
              <button type="button" onClick={() => onRemove(timestamp)} style={{ position: 'absolute', right: 6, top: 4, border: 'none', background: 'transparent', color: '#d00', fontWeight: 'bold', fontSize: 18, cursor: 'pointer' }} title="Supprimer">×</button>
            )}
          </div>
        ))}
      {Object.keys(notes).length === 0 && (
        <div className="no-notes">Aucune note pour l'instant</div>
      )}
      {/* Formulaire d'ajout de note (si édition) */}
      {onAdd && (
        !showForm ? (
          <button type="button" className="add-note-btn" onClick={() => setShowForm(true)}>Ajouter une note</button>
        ) : (
          <div style={{ marginTop: 8 }}>
            <input type="date" className="add-note-date" value={date} onChange={e => setDate(e.target.value)} />
            <select className="add-note-matiere" value={matiere} onChange={e => setMatiere(e.target.value)}>
              <option value="">Choisir une matière</option>
              <option value="Mathématiques">Mathématiques</option>
              <option value="Français">Français</option>
              <option value="Histoire-Géo">Histoire-Géo</option>
              <option value="Anglais">Anglais</option>
              <option value="SVT">SVT</option>
              <option value="Physique-Chimie">Physique-Chimie</option>
              <option value="EPS">EPS</option>
              <option value="Arts">Arts</option>
              <option value="Technologie">Technologie</option>
              <option value="Autre">Autre</option>
            </select>
            <input type="number" min="0" max="20" className="add-note-note" placeholder="Note" value={note} onChange={e => setNote(e.target.value)} />
            <button type="button" className="add-note-btn" onClick={handleValidate}>Valider</button>
            <button type="button" className="add-note-btn" style={{ background: 'var(--color-border-strong)', color: 'var(--color-text-primary)' }} onClick={handleCancel}>Annuler</button>
            {err && <span className="add-note-error">{err}</span>}
          </div>
        )
      )}
      {/* Champ caché pour la soumission si édition */}
      {onAdd && (
        <input type="hidden" name="notes" value={notes ? JSON.stringify(notes) : ''} />
      )}
    </div>
  );
}

function TargetsProfilingBlock({ form, setForm }) {
  const { targetDefinitions, targetDefinitionsLoaded, feeDefinitions } = useContext(AiAdminContext);
  const targetsList = form.targetsList || {};

  const getOptionPriceLabel = (opt, tdKey) => {
    if (!feeDefinitions) return '';
    const matches = [];
    feeDefinitions.forEach(fd => {
      const t = (fd.targets || []).find(tar => tar.label === opt && (tar.key === tdKey || fd.id === 'scol'));
      if (t && t.amount > 0) {
        matches.push(`${fd.label}: +${t.amount} ${fd.unit}`);
      }
    });
    return matches.length > 0 ? ` (${matches.join(', ')})` : '';
  };

  const updateTarget = (key, value) => {
    if (!setForm) return;
    setForm(f => ({
      ...f,
      targetsList: { ...f.targetsList, [key]: value }
    }));
  };

  const removeTarget = (key) => {
    if (!setForm) return;
    setForm(f => {
      const next = { ...f.targetsList };
      delete next[key];
      return { ...f, targetsList: next };
    });
  };

  if (!targetDefinitionsLoaded) return <div className="loading-small">Chargement profil...</div>;

  return (
    <div className="targets-profiling-block">
      {targetDefinitions.map(td => {
        const currentValue = targetsList[td.key];

        // ── Booléens / Switches (is*) ─────────────────
        if (td.key.startsWith('is')) {
          const firstOpt = td.options[0];
          const isSet = currentValue === firstOpt;
          return (
            <div key={td.key} className="isinterne-card profiling-card">
              <label className="isinterne-label">
                <input
                  type="checkbox"
                  checked={isSet}
                  onChange={e => e.target.checked ? updateTarget(td.key, firstOpt) : removeTarget(td.key)}
                  disabled={!setForm}
                />
                <span>{firstOpt}{getOptionPriceLabel(firstOpt, td.key)}</span>
              </label>
            </div>
          );
        }

        // ── Choix unique / Radio (do*) ─────────────────
        if (td.key.startsWith('do')) {
          return (
            <div key={td.key} className="profiling-card">
              <div className="profiling-card__head">
                <div className="profiling-card__title">{td.key.replace(/^do/, '')}</div>
                {setForm && currentValue && (
                  <button type="button" className="profiling-card__reset" onClick={() => removeTarget(td.key)}>
                    Réinitialiser
                  </button>
                )}
              </div>
              <div className="profiling-card__options">
                {td.options.map(opt => (
                  <label key={opt} className="profiling-card__option">
                    <input
                      type="radio"
                      name={td.key}
                      value={opt}
                      checked={currentValue === opt}
                      onChange={() => updateTarget(td.key, opt)}
                      disabled={!setForm}
                    /> {opt}{getOptionPriceLabel(opt, td.key)}
                  </label>
                ))}
              </div>
            </div>
          );
        }

        // ── Multi-choix / Checkboxes (autre) ───────────
        return (
          <div key={td.key} className="profiling-card">
            <div className="profiling-card__title">{td.key}</div>
            <div className="profiling-card__options">
              {td.options.map(opt => {
                const checked = Array.isArray(currentValue) ? currentValue.includes(opt) : false;
                return (
                  <label key={opt} className="profiling-card__option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        let next = Array.isArray(currentValue) ? [...currentValue] : [];
                        if (e.target.checked) next.push(opt);
                        else next = next.filter(o => o !== opt);
                        updateTarget(td.key, next);
                      }}
                      disabled={!setForm}
                    /> {opt}{getOptionPriceLabel(opt, td.key)}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentsBlock({ form, setForm, selectedDocuments = [], setSelectedDocuments }) {
  // Edition : upload et renommage
  const isEdit = !!setForm;
  return (
    <div className="documents-block">
      <label>Documents</label>
      {isEdit && (
        <input
          type="file"
          accept=".pdf,image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={e => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            setSelectedDocuments(prev => ([
              ...prev,
              ...files.map(file => ({ file, customName: file.name }))
            ]));
            e.target.value = '';
          }}
        />
      )}
      {/* Affichage des documents déjà enregistrés (form.documents) */}
      {Array.isArray(form.documents) && form.documents.length > 0 && (
        <div className="documents-list">
          {form.documents.map((doc, i) => (<Fragment key={doc.name + '-' + i}>
            <div className="document-item"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => {
                const type = doc.type?.startsWith("image/") && doc.type !== "application/pdf" ? "img" : "pdf"
                const img = document.querySelector('.documents-list img.docs_preview_img');
                const frame = document.querySelector('.documents-list iframe.docs_preview_pdf');
                if (type == "img") img.src = doc;
                if (type == "pdf") frame.src = doc;
              }}>
              {doc.type}
              {doc.type === "application/pdf"
                ? <span className="doc-icon" title="PDF">📄</span>
                : <span className="doc-icon" title="Image">🖼️</span>}
              <span>{doc.name}</span>
            </div>
            {doc && <a href={doc} target="_blank">
              <span className="doc-icon" title="Télécharger"> Télécharger</span>
              <img className="docs_preview_img" src={null} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', margin: '16px auto' }} />
              <iframe className="docs_preview_pdf" src={null} alt="" style={{ maxWidth: '100%', maxHeight: '70vh', margin: '16px auto' }} />
            </a>}
          </Fragment>))}
        </div>
      )}
      {/* Affichage des documents sélectionnés pour upload (édition) */}
      {isEdit && Array.isArray(selectedDocuments) && selectedDocuments.length > 0 && (
        <div className="documents-list">
          {selectedDocuments.map((doc, i) => (
            <div className="document-item" key={doc.file.name + '-' + i}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {doc.file.type === "application/pdf"
                ? <span className="doc-icon" title="PDF">📄</span>
                : <span className="doc-icon" title="Image">🖼️</span>}
              <span>{doc.file.name}</span>
              <input
                type="text"
                value={doc.customName}
                onChange={e => {
                  const newDocs = [...selectedDocuments];
                  newDocs[i].customName = e.target.value;
                  setSelectedDocuments(newDocs);
                }}
                placeholder="Nom final du fichier"
                style={{ marginLeft: 8, flex: 1 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Composant pour gérer les compositions d'une classe
function CompositionsManager({ compositions = [], onChange }) {
  const [newDate, setNewDate] = useState('');
  const [newOfficiel, setNewOfficiel] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = () => {
    if (!newDate) return;

    const timestamp = new Date(newDate).getTime();
    const newComposition = [timestamp, newOfficiel];
    const updatedCompositions = [...compositions, newComposition];

    // Trier par date (timestamp croissant)
    updatedCompositions.sort((a, b) => a[0] - b[0]);

    onChange(updatedCompositions);
    setNewDate('');
    setNewOfficiel(true);
    setShowAddForm(false);
  };

  const handleRemove = (index) => {
    const updatedCompositions = compositions.filter((_, i) => i !== index);
    onChange(updatedCompositions);
  };

  return (
    <div className="compositions-manager">
      {/* Liste des compositions existantes */}
      <div className="compositions-manager__list">
        {compositions.length === 0 ? (
          <p className="compositions-manager__empty">Aucune composition définie</p>
        ) : (
          compositions.map(([timestamp, officiel], index) => (
            <div key={index} className="compositions-manager__item">
              <span className="compositions-manager__date">
                {new Date(timestamp).toLocaleDateString('fr-FR')}
              </span>
              <span className={`compositions-manager__badge ${officiel ? 'compositions-manager__badge--officiel' : 'compositions-manager__badge--non-officiel'}`}>
                {officiel ? 'Officiel' : 'Non officiel'}
              </span>
              <button
                type="button"
                className="compositions-manager__remove-btn"
                onClick={() => handleRemove(index)}
                title="Supprimer cette composition"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Bouton d'ajout */}
      {!showAddForm && (
        <button
          type="button"
          className="compositions-manager__add-btn"
          onClick={() => setShowAddForm(true)}
        >
          ➕ Ajouter une composition
        </button>
      )}

      {/* Formulaire d'ajout */}
      {showAddForm && (
        <div className="compositions-manager__add-form">
          <div className="compositions-manager__form-row">
            <input
              type="date"
              className="compositions-manager__date-input"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />

            <button
              type="button"
              className={`compositions-manager__officiel-toggle ${newOfficiel ? 'compositions-manager__officiel-toggle--active' : ''}`}
              onClick={() => setNewOfficiel(!newOfficiel)}
              title="Cliquer pour changer le type"
            >
              {newOfficiel ? 'Officiel' : 'Non officiel'}
            </button>
          </div>

          <div className="compositions-manager__form-actions">
            <button
              type="button"
              className="compositions-manager__validate-btn"
              onClick={handleAdd}
              disabled={!newDate}
            >
              Valider
            </button>

            <button
              type="button"
              className="compositions-manager__cancel-btn"
              onClick={() => {
                setShowAddForm(false);
                setNewDate('');
                setNewOfficiel(true);
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Bloc de gestion du Corps Enseignant et Coefficients (Collège/Lycée) ---
function CorpsEnseignantManager({ corpsEnseignant = [], coefficients = {}, onChange, enseignants = [], dynamicSubjects = [], subjectsLoaded }) {
  const [selectedMatiere, setSelectedMatiere] = useState('');
  const [selectedProf, setSelectedProf] = useState('');
  const [salle, setSalle] = useState('');
  const [coeffDenominateur, setCoeffDenominateur] = useState('20');

  // Initialisation par défaut
  useEffect(() => {
    if (subjectsLoaded && dynamicSubjects.length > 0 && !selectedMatiere) {
      setSelectedMatiere(dynamicSubjects[0].id);
    }
    if (enseignants.length > 0 && !selectedProf) {
      setSelectedProf(enseignants[0]._id);
    }
  }, [dynamicSubjects, subjectsLoaded, enseignants, selectedMatiere, selectedProf]);

  const handleAdd = () => {
    if (!selectedMatiere || !selectedProf) return;
    
    const newCorps = corpsEnseignant.filter(c => c.matiereId !== selectedMatiere);
    newCorps.push({
      matiereId: selectedMatiere,
      enseignantId: selectedProf,
      sallePrincipale: salle
    });

    const newCoefficients = { ...coefficients };
    const coeffVal = Math.max(1, Math.floor(parseInt(coeffDenominateur) / 10));
    newCoefficients[selectedMatiere] = coeffVal;

    onChange({ corpsEnseignant: newCorps, coefficients: newCoefficients });
    setSalle('');
  };

  const handleRemove = (matiereId) => {
    const newCorps = corpsEnseignant.filter(c => c.matiereId !== matiereId);
    const newCoefficients = { ...coefficients };
    delete newCoefficients[matiereId];
    onChange({ corpsEnseignant: newCorps, coefficients: newCoefficients });
  };

  if (!subjectsLoaded) return <div className="coefficients-manager__loading">Chargement des matières...</div>;

  return (
    <div className="corps-enseignant-manager">
      {/* Formulaire d'ajout en 1 ligne fluide */}
      <div className="corps-enseignant-manager__form">
        <select 
          value={selectedMatiere} 
          onChange={e => setSelectedMatiere(e.target.value)}
          className="corps-enseignant-manager__select"
        >
          <option value="" disabled>-- Matière --</option>
          {dynamicSubjects.map(m => (
            <option key={m.id} value={m.id}>{m.nom}</option>
          ))}
        </select>
        
        <select 
          value={selectedProf} 
          onChange={e => setSelectedProf(e.target.value)}
          className="corps-enseignant-manager__select"
        >
          <option value="" disabled>-- Enseignant --</option>
          {enseignants.map(p => (
            <option key={p._id} value={p._id}>
              {p.nom} {Array.isArray(p.prenoms) ? p.prenoms.join(' ') : p.prenoms}
            </option>
          ))}
        </select>

        <input 
          type="text" 
          value={salle} 
          onChange={e => setSalle(e.target.value)}
          placeholder="Salle (ex: 102)"
          className="corps-enseignant-manager__input"
        />

        <select
          value={coeffDenominateur}
          onChange={e => setCoeffDenominateur(e.target.value)}
          className="corps-enseignant-manager__select"
        >
          <option value="10">Coeff 1 (/10)</option>
          <option value="20">Coeff 2 (/20)</option>
          <option value="30">Coeff 3 (/30)</option>
          <option value="40">Coeff 4 (/40)</option>
          <option value="50">Coeff 5 (/50)</option>
        </select>

        <button 
          type="button" 
          onClick={handleAdd} 
          className="corps-enseignant-manager__add-btn"
        >
          + Assigner
        </button>
      </div>

      {/* Tableau des matières configurées */}
      <div className="corps-enseignant-manager__table-wrapper">
        {corpsEnseignant.length > 0 ? (
          <table className="corps-enseignant-manager__table">
            <thead>
              <tr>
                <th>Matière</th>
                <th>Enseignant & Salle</th>
                <th>Coefficient</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {corpsEnseignant.map((assignment, idx) => {
                const matiere = dynamicSubjects.find(m => m.id === assignment.matiereId);
                const prof = enseignants.find(p => p._id === assignment.enseignantId);
                if (!matiere || !prof) return null;
                const coeff = coefficients[assignment.matiereId] || 2;

                return (
                  <tr key={idx}>
                    <td className="corps-enseignant-manager__subject-name">
                      {matiere.nom}
                    </td>
                    <td>
                      <span className="corps-enseignant-manager__prof-badge">
                        👨‍🏫 {prof.nom} {Array.isArray(prof.prenoms) ? prof.prenoms.join(' ') : prof.prenoms}
                        {assignment.sallePrincipale && <span className="corps-enseignant-manager__salle-badge">📍 {assignment.sallePrincipale}</span>}
                      </span>
                    </td>
                    <td>
                      <span className="corps-enseignant-manager__coeff-badge">
                        📊 Coeff {coeff} <span>(sur {coeff * 10})</span>
                      </span>
                    </td>
                    <td>
                      <button 
                        type="button" 
                        onClick={() => handleRemove(assignment.matiereId)} 
                        className="corps-enseignant-manager__remove-btn"
                        title="Supprimer cette matière"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="corps-enseignant-manager__empty">
            Aucun professeur ni coefficient attribué pour le moment.
          </p>
        )}
      </div>

      <div className="corps-enseignant-manager__info">
        <p><strong>💡 Note :</strong> L'enseignant assigné et le coefficient de la matière sont enregistrés simultanément. Le coefficient (1 à 5) définit l'impact de la matière sur le calcul des moyennes trimestrielles du collège.</p>
      </div>
    </div>
  );
}

// --- Bloc de gestion du Délégué Unique ---
function DeleguesManager({ delegues = [], onChange, elevesClasse = [] }) {
  const currentDelegueId = Array.isArray(delegues) ? delegues[0] || '' : (delegues || '');

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val ? [val] : []);
  };

  if (!elevesClasse || elevesClasse.length === 0) {
    return <p className="corps-enseignant-manager__empty">Veuillez d'abord assigner des élèves à cette classe via leur fiche élève.</p>;
  }

  const selectedEleve = elevesClasse.find(e => e._id === currentDelegueId);

  return (
    <div className="delegues-manager">
      <div className="delegues-manager__form">
        <label className="delegues-manager__label">
          Délégué de classe :
        </label>
        <select 
          value={currentDelegueId} 
          onChange={handleChange}
          className="delegues-manager__select"
        >
          <option value="">-- Aucun délégué désigné --</option>
          {elevesClasse.map(e => (
            <option key={e._id} value={e._id}>
              {e.nom} {Array.isArray(e.prenoms) ? e.prenoms.join(' ') : e.prenoms}
            </option>
          ))}
        </select>
      </div>

      {selectedEleve && (
        <div className="delegues-manager__badge">
          <span>
            🎓 Délégué élu : {selectedEleve.nom} {Array.isArray(selectedEleve.prenoms) ? selectedEleve.prenoms.join(' ') : selectedEleve.prenoms}
          </span>
          <button 
            type="button" 
            onClick={() => onChange([])} 
            className="delegues-manager__remove-btn" 
            title="Retirer ce délégué"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// --- Bloc de gestion des Demi-groupes / Options ---
function GroupesManager({ groupes = [], onChange, elevesClasse = [] }) {
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(null);
  const [selectedEleve, setSelectedEleve] = useState('');

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    onChange([...groupes, { nom: newGroupName.trim(), eleves: [] }]);
    setNewGroupName('');
  };

  const handleRemoveGroup = (idx) => {
    const newGroupes = [...groupes];
    newGroupes.splice(idx, 1);
    onChange(newGroupes);
    if (selectedGroupIndex === idx) setSelectedGroupIndex(null);
  };

  const handleAddEleveToGroup = () => {
    if (selectedGroupIndex === null || !selectedEleve) return;
    const newGroupes = [...groupes];
    if (!newGroupes[selectedGroupIndex].eleves.includes(selectedEleve)) {
      newGroupes[selectedGroupIndex].eleves.push(selectedEleve);
      onChange(newGroupes);
    }
    setSelectedEleve('');
  };

  const handleRemoveEleveFromGroup = (groupIndex, eleveId) => {
    const newGroupes = [...groupes];
    newGroupes[groupIndex].eleves = newGroupes[groupIndex].eleves.filter(id => id !== eleveId);
    onChange(newGroupes);
  };

  return (
    <div className="coefficients-manager">
      <div className="compositions-block__add-form coefficients-manager__add-form" style={{ flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
        <input 
          type="text" 
          value={newGroupName} 
          onChange={e => setNewGroupName(e.target.value)}
          placeholder="Nom du groupe (ex: Groupe A, LV2 Allemand)"
          className="modal__input"
          style={{ flexGrow: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="button" onClick={handleCreateGroup} className="compositions-block__add-btn">
          Créer un groupe
        </button>
      </div>

      {groupes.length > 0 ? (
        <div className="coefficients-manager__configured">
          {groupes.map((grp, idx) => (
            <div key={idx} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, color: '#1E3A8A' }}>{grp.nom} ({grp.eleves.length} élèves)</h4>
                <button type="button" onClick={() => handleRemoveGroup(idx)} className="modal__actions-btn modal__actions-btn--danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                  Supprimer ce groupe
                </button>
              </div>

              {elevesClasse && elevesClasse.length > 0 ? (
                <div className="compositions-block__add-form" style={{ display: 'flex', gap: '10px', marginBottom: '1rem' }}>
                  <select 
                    value={selectedGroupIndex === idx ? selectedEleve : ''} 
                    onChange={e => {
                      setSelectedGroupIndex(idx);
                      setSelectedEleve(e.target.value);
                    }}
                    className="compositions-block__matiere-select"
                    style={{ flexGrow: 1 }}
                  >
                    <option value="" disabled>-- Ajouter un élève au groupe --</option>
                    {elevesClasse.map(e => (
                      <option key={e._id} value={e._id} disabled={grp.eleves.includes(e._id)}>
                        {e.nom} {Array.isArray(e.prenoms) ? e.prenoms.join(' ') : e.prenoms} {grp.eleves.includes(e._id) ? '(Déjà dans le groupe)' : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={handleAddEleveToGroup} className="compositions-block__add-btn" disabled={selectedGroupIndex !== idx || !selectedEleve}>
                    Ajouter
                  </button>
                </div>
              ) : (
                 <p className="coefficients-manager__empty" style={{ marginBottom: '1rem' }}>Veuillez d'abord assigner des élèves à la classe.</p>
              )}

              <div className="coefficients-manager__list">
                {grp.eleves.map((eleveId) => {
                  const eleve = elevesClasse.find(e => e._id === eleveId);
                  if (!eleve) return null;
                  return (
                    <div key={eleveId} className="coefficients-manager__configured-item" style={{ padding: '0.2rem 0.5rem', background: '#f8f9fa' }}>
                      <span>{eleve.nom} {Array.isArray(eleve.prenoms) ? eleve.prenoms.join(' ') : eleve.prenoms}</span>
                      <button type="button" onClick={() => handleRemoveEleveFromGroup(idx, eleveId)} className="coefficients-manager__remove-btn" title="Retirer l'élève du groupe">×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="coefficients-manager__empty">Aucun demi-groupe ou groupe d'option n'a été créé.</p>
      )}
    </div>
  );
}

export { SchoolHistoryBlock, ScolarityFeesBlock, TargetsProfilingBlock, AddNoteForm, CompositionsBlock, CommentairesBlock, Parent, AbsencesBlock, BonusBlock, ManusBlock, DocumentsBlock, CompositionsManager, CoefficientsManager, CorpsEnseignantManager, DeleguesManager, GroupesManager, generateSchoolYears, migrateCompositionsFormat };

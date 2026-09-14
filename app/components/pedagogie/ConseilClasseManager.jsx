"use client";

import { useState, useEffect, useCallback, useContext } from 'react';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import './ConseilClasseManager.scss';

export default function ConseilClasseManager({ classIdProp = null, schoolYearProp = '2023-2024' }) {
  const ctx = useContext(AiAdminContext);
  const classes = ctx?.classes || [];
  const elevesAll = ctx?.eleves || [];
  const enseignantsAll = ctx?.enseignants || [];

  const [selectedClassId, setSelectedClassId] = useState(classIdProp || (classes[0]?._id || ''));
  const [selectedTrimestre, setSelectedTrimestre] = useState(1);
  const [selectedAnnee, setSelectedAnnee] = useState(schoolYearProp);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Données du conseil
  const [presents, setPresents] = useState([]);
  const [decisionsMap, setDecisionsMap] = useState({}); // { [eleveId]: { mention, appreciationGenerale, orientationAvis } }
  const [compteRendu, setCompteRendu] = useState('');

  // Élève actuellement sélectionné dans le formulaire unique
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Formulaire temporaire pour l'élève actif
  const [tempMention, setTempMention] = useState('AUCUNE');
  const [tempAppreciation, setTempAppreciation] = useState('');
  const [tempOrientation, setTempOrientation] = useState('');

  // Si props change, mettre à jour
  useEffect(() => {
    if (classIdProp) setSelectedClassId(classIdProp);
  }, [classIdProp]);

  // Classe actuellement sélectionnée
  const currentClasse = classes.find(c => String(c._id) === String(selectedClassId));
  const elevesClasse = elevesAll.filter(e => String(e.current_classe) === String(selectedClassId));

  // Sélectionner par défaut le premier élève si disponible
  useEffect(() => {
    if (elevesClasse.length > 0 && !activeStudentId) {
      setActiveStudentId(elevesClasse[0]._id);
    }
  }, [elevesClasse, activeStudentId]);

  // Charger ou mettre à jour le formulaire temporaire lors du changement d'élève actif ou de decisionsMap
  useEffect(() => {
    if (activeStudentId) {
      const existingDec = decisionsMap[activeStudentId];
      if (existingDec) {
        setTempMention(existingDec.mention || 'AUCUNE');
        setTempAppreciation(existingDec.appreciationGenerale || '');
        setTempOrientation(existingDec.orientationAvis || '');
      } else {
        setTempMention('AUCUNE');
        setTempAppreciation('');
        setTempOrientation('');
      }
    }
  }, [activeStudentId, decisionsMap]);

  // Récupération des données du conseil de classe
  const fetchConseil = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(`/api/school_ai/conseil?classeId=${selectedClassId}&trimestre=${selectedTrimestre}&annee=${selectedAnnee}`);
      if (!res.ok) throw new Error('Erreur lors du chargement du conseil');
      const data = await res.json();
      
      const existing = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (existing) {
        setPresents(existing.presents ? existing.presents.map(p => typeof p === 'object' ? p._id : p) : []);
        setCompteRendu(existing.compteRendu || '');

        const dMap = {};
        if (Array.isArray(existing.decisions)) {
          existing.decisions.forEach(d => {
            const eId = typeof d.eleveId === 'object' ? d.eleveId._id : d.eleveId;
            dMap[eId] = {
              mention: d.mention || 'AUCUNE',
              appreciationGenerale: d.appreciationGenerale || '',
              orientationAvis: d.orientationAvis || ''
            };
          });
        }
        setDecisionsMap(dMap);
      } else {
        setPresents([]);
        setCompteRendu('');
        setDecisionsMap({});
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedTrimestre, selectedAnnee]);

  useEffect(() => {
    fetchConseil();
  }, [fetchConseil]);

  // Toggle présence prof
  const toggleTeacherPresent = (profId) => {
    setPresents(prev => 
      prev.includes(profId) ? prev.filter(id => id !== profId) : [...prev, profId]
    );
  };

  // Sélectionner un élève pour édition dans la carte unique
  const handleSelectStudent = (eleveId) => {
    setActiveStudentId(eleveId);
  };

  // Valider et enregistrer la décision de l'élève actif dans decisionsMap
  const handleValidateStudentDecision = () => {
    if (!activeStudentId) return;
    setDecisionsMap(prev => ({
      ...prev,
      [activeStudentId]: {
        mention: tempMention,
        appreciationGenerale: tempAppreciation,
        orientationAvis: tempOrientation
      }
    }));
    setMessage({ type: 'success', text: `✅ Décision enregistrée pour l'élève !` });
    setTimeout(() => setMessage(null), 3000);
  };

  // Supprimer la décision d'un élève
  const handleDeleteStudentDecision = (eleveId) => {
    setDecisionsMap(prev => {
      const copy = { ...prev };
      delete copy[eleveId];
      return copy;
    });
  };

  // Enregistrer tout le Conseil de Classe en base
  const handleSave = async () => {
    if (!selectedClassId) return;
    try {
      setSaving(true);
      setMessage(null);

      const decisionsArray = elevesClasse.map(e => ({
        eleveId: e._id,
        mention: decisionsMap[e._id]?.mention || 'AUCUNE',
        appreciationGenerale: decisionsMap[e._id]?.appreciationGenerale || '',
        orientationAvis: decisionsMap[e._id]?.orientationAvis || ''
      }));

      const res = await fetch('/api/school_ai/conseil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classeId: selectedClassId,
          trimestre: selectedTrimestre,
          annee: selectedAnnee,
          presents,
          decisions: decisionsArray,
          compteRendu
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la sauvegarde du conseil');
      setMessage({ type: 'success', text: '💾 Conseil de classe enregistré avec succès !' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Déclencher la génération automatique des bulletins
  const handleGenerateBulletins = async () => {
    if (!selectedClassId) return;
    try {
      setSaving(true);
      setMessage(null);

      const appreciationsPayload = {};
      elevesClasse.forEach(e => {
        const dec = decisionsMap[e._id];
        if (dec) {
          appreciationsPayload[e._id] = {
            general: dec.appreciationGenerale || ''
          };
        }
      });

      const res = await fetch(`/api/classes/${selectedClassId}/report-cards/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolYear: selectedAnnee,
          period: `TRIMESTRE_${selectedTrimestre}`,
          appreciations: appreciationsPayload
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur génération bulletins');
      setMessage({ type: 'success', text: `📜 Bulletins du Trimestre ${selectedTrimestre} générés pour ${data.data.count} élèves !` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const isTroisieme = currentClasse?.niveau === '3ème';
  const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));

  const getMentionLabel = (m) => {
    switch (m) {
      case 'FELICITATIONS': return '🏆 Félicitations';
      case 'COMPLIMENTS': return '👏 Compliments';
      case 'ENCOURAGEMENTS': return '👍 Encouragements';
      case 'MISE_EN_GARDE_TRAVAIL': return '⚠️ MG Travail';
      case 'MISE_EN_GARDE_CONDUITE': return '⚠️ MG Conduite';
      case 'AVERTISSEMENT_TRAVAIL': return '🚨 Av. Travail';
      case 'AVERTISSEMENT_CONDUITE': return '🚨 Av. Conduite';
      default: return 'Pas de mention';
    }
  };

  return (
    <div className="conseil-manager">
      {/* En-tête des filtres */}
      <div className="conseil-manager__toolbar">
        {!classIdProp && (
          <div className="conseil-manager__field">
            <label>Classe :</label>
            <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
              <option value="">-- Sélectionner une classe --</option>
              {classes.map(c => (
                <option key={c._id} value={c._id}>
                  {c.niveau} {c.alias} ({c.annee})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="conseil-manager__field">
          <label>Trimestre :</label>
          <select value={selectedTrimestre} onChange={e => setSelectedTrimestre(Number(e.target.value))}>
            <option value={1}>Trimestre 1</option>
            <option value={2}>Trimestre 2</option>
            <option value={3}>Trimestre 3</option>
          </select>
        </div>

        <div className="conseil-manager__field">
          <label>Année :</label>
          <input
            type="text"
            value={selectedAnnee}
            onChange={e => setSelectedAnnee(e.target.value)}
            style={{ width: '110px' }}
          />
        </div>
      </div>

      {message && (
        <div className={`conseil-manager__alert conseil-manager__alert--${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="conseil-manager__loading">Chargement des données du conseil...</div>
      ) : !selectedClassId ? (
        <div className="conseil-manager__empty">Veuillez sélectionner une classe.</div>
      ) : (
        <div className="conseil-manager__body">
          {/* Section 1: Boutons Icon-Image des Enseignants Présents */}
          <div className="conseil-manager__section">
            <h4 className="conseil-manager__section-title">
              👥 Membres du Conseil & Enseignants Présents ({presents.length}/{enseignantsAll.length} présents)
            </h4>
            <div className="conseil-manager__icon-grid">
              {enseignantsAll.map(prof => {
                const isPresent = presents.includes(prof._id);
                return (
                  <button
                    key={prof._id}
                    type="button"
                    className={`conseil-icon-btn ${isPresent ? 'conseil-icon-btn--active' : ''}`}
                    onClick={() => toggleTeacherPresent(prof._id)}
                    title={`M./Mme ${prof.nom} ${prof.prenoms?.[0] || ''}`}
                  >
                    <div className="conseil-icon-btn__avatar">
                      <img src={prof.photo || '/school/prof.webp'} alt={prof.nom} />
                      {isPresent && <span className="conseil-icon-btn__badge">✅</span>}
                    </div>
                    <span className="conseil-icon-btn__name">{prof.nom} {prof.prenoms?.[0] || ''}.</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Boutons Icon-Image des Élèves de la classe */}
          <div className="conseil-manager__section">
            <h4 className="conseil-manager__section-title">
              🎓 Sélectionner un élève à examiner ({elevesClasse.length} élèves)
            </h4>

            {elevesClasse.length === 0 ? (
              <p className="conseil-manager__empty">Aucun élève inscrit dans cette classe.</p>
            ) : (
              <div className="conseil-manager__icon-grid">
                {elevesClasse.map(eleve => {
                  const isSelected = String(eleve._id) === String(activeStudentId);
                  const dec = decisionsMap[eleve._id];
                  const hasDecision = !!dec && (dec.mention !== 'AUCUNE' || !!dec.appreciationGenerale?.trim());

                  return (
                    <button
                      key={eleve._id}
                      type="button"
                      className={`conseil-icon-btn ${isSelected ? 'conseil-icon-btn--selected' : ''} ${hasDecision ? 'conseil-icon-btn--validated' : ''}`}
                      onClick={() => handleSelectStudent(eleve._id)}
                    >
                      <div className="conseil-icon-btn__avatar">
                        <img src={eleve.photo || '/school/classe.webp'} alt={eleve.nom} />
                        {hasDecision && <span className="conseil-icon-btn__badge">⭐</span>}
                      </div>
                      <span className="conseil-icon-btn__name">{eleve.nom} {eleve.prenoms?.[0] || ''}.</span>
                      {hasDecision && dec.mention !== 'AUCUNE' && (
                        <span className="conseil-icon-btn__subtag">{getMentionLabel(dec.mention)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: CARTE UNIQUE D'ÉDITION POUR L'ÉLÈVE SÉLECTIONNÉ */}
          {activeStudent && (
            <div className="conseil-manager__section">
              <h4 className="conseil-manager__section-title">
                📝 Édition de la décision pour {activeStudent.nom} {activeStudent.prenoms?.join(' ')}
              </h4>

              <div className="conseil-student-card conseil-student-card--single-editor">
                <div className="conseil-student-card__header">
                  <div className="conseil-student-card__identity">
                    <span className="conseil-student-card__avatar">
                      <img src={activeStudent.photo || '/school/classe.webp'} alt="" />
                    </span>
                    <div>
                      <strong>{activeStudent.nom} {activeStudent.prenoms?.join(' ')}</strong>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Classe : {currentClasse?.alias}</div>
                    </div>
                  </div>

                  {/* Attribution de la mention */}
                  <div className="conseil-student-card__mention-select">
                    <label>Mention :</label>
                    <select
                      value={tempMention}
                      onChange={e => setTempMention(e.target.value)}
                    >
                      <option value="AUCUNE">Pas de mention</option>
                      <option value="FELICITATIONS">🏆 Félicitations</option>
                      <option value="COMPLIMENTS">👏 Compliments</option>
                      <option value="ENCOURAGEMENTS">👍 Encouragements</option>
                      <option value="MISE_EN_GARDE_TRAVAIL">⚠️ Mise en garde Travail</option>
                      <option value="MISE_EN_GARDE_CONDUITE">⚠️ Mise en garde Conduite</option>
                      <option value="AVERTISSEMENT_TRAVAIL">🚨 Avertissement Travail</option>
                      <option value="AVERTISSEMENT_CONDUITE">🚨 Avertissement Conduite</option>
                    </select>
                  </div>
                </div>

                {/* Appréciation générale du PP / Conseil */}
                <div className="conseil-student-card__field">
                  <label>Appréciation du Conseil de Classe / Professeur Principal :</label>
                  <textarea
                    rows="3"
                    placeholder="Rédiger l'appréciation globale et la synthèse du trimestre pour cet élève..."
                    value={tempAppreciation}
                    onChange={e => setTempAppreciation(e.target.value)}
                  />
                </div>

                {/* Avis d'orientation (3ème) */}
                {isTroisieme && (
                  <div className="conseil-student-card__field conseil-student-card__field--orientation">
                    <label>🎯 Avis d'Orientation (3ème) :</label>
                    <input
                      type="text"
                      placeholder="Ex: Avis très favorable pour la voie Générale & Technologique"
                      value={tempOrientation}
                      onChange={e => setTempOrientation(e.target.value)}
                    />
                  </div>
                )}

                {/* BOUTON DE VALIDATION DE LA CARTE UNIQUE */}
                <div className="conseil-student-card__editor-actions">
                  <button
                    type="button"
                    className="conseil-student-card__validate-btn"
                    onClick={handleValidateStudentDecision}
                  >
                    ✅ Valider la décision pour {activeStudent.nom}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Liste des décisions validées / configurées */}
          {Object.keys(decisionsMap).length > 0 && (
            <div className="conseil-manager__section">
              <h4 className="conseil-manager__section-title">
                📋 Décisions validées pour la classe ({Object.keys(decisionsMap).length} / {elevesClasse.length})
              </h4>
              <div className="conseil-validated-list">
                {Object.entries(decisionsMap).map(([eId, dec]) => {
                  const student = elevesClasse.find(e => String(e._id) === String(eId));
                  if (!student) return null;
                  return (
                    <div key={eId} className="conseil-validated-item">
                      <div className="conseil-validated-item__info">
                        <img src={student.photo || '/school/classe.webp'} alt="" className="conseil-validated-item__avatar" />
                        <div>
                          <strong>{student.nom} {student.prenoms?.[0]}.</strong>
                          <div className="conseil-validated-item__mention">{getMentionLabel(dec.mention)}</div>
                        </div>
                      </div>
                      <p className="conseil-validated-item__appr">{dec.appreciationGenerale || <em>Aucune appréciation textuelle</em>}</p>
                      <div className="conseil-validated-item__actions">
                        <button
                          type="button"
                          className="conseil-validated-item__edit-btn"
                          onClick={() => handleSelectStudent(eId)}
                          title="Modifier"
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          type="button"
                          className="conseil-validated-item__delete-btn"
                          onClick={() => handleDeleteStudentDecision(eId)}
                          title="Supprimer la décision"
                        >
                          🗑️ Supprimer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 5: Compte-rendu global de la classe */}
          <div className="conseil-manager__section">
            <h4 className="conseil-manager__section-title">📝 Bilan Global / Compte-rendu du Conseil</h4>
            <textarea
              rows="4"
              placeholder="Rédiger le compte-rendu général de la classe pour ce trimestre..."
              value={compteRendu}
              onChange={e => setCompteRendu(e.target.value)}
              className="conseil-manager__compte-rendu"
            />
          </div>

          {/* Actions finales */}
          <div className="conseil-manager__actions">
            <button
              type="button"
              className="conseil-manager__btn-save"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? 'Enregistrement...' : '💾 Enregistrer le Conseil de Classe'}
            </button>

            <button
              type="button"
              className="conseil-manager__btn-generate"
              disabled={saving}
              onClick={handleGenerateBulletins}
            >
              {saving ? 'Génération...' : '📜 Générer les Bulletins Officiels T' + selectedTrimestre}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

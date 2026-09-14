"use client";

import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import { useUserRole } from '../../../stores/useUserRole';
import './SocleCommunManager.scss';

export const DOMAINES_SOCLE = [
  { id: 'D1_1', code: 'D1.1', title: 'Langue française à l’oral et à l’écrit', desc: 'S’exprimer, lire, écrire et comprendre en français', icon: '📖' },
  { id: 'D1_2', code: 'D1.2', title: 'Langues étrangères et régionales', desc: 'Compréhension et expression en LV1 / LV2', icon: '🌍' },
  { id: 'D1_3', code: 'D1.3', title: 'Langages mathématiques, scientifiques et informatiques', desc: 'Raisonnement, calcul et culture numérique', icon: '📐' },
  { id: 'D1_4', code: 'D1.4', title: 'Langages des arts et du corps', desc: 'Expression artistique, musicale et activité physique', icon: '🎨' },
  { id: 'D2', code: 'D2', title: 'Méthodes et outils pour apprendre', desc: 'Autonomie, organisation du travail, projets et recherche', icon: '🛠️' },
  { id: 'D3', code: 'D3', title: 'Formation de la personne et du citoyen', desc: 'Esprit critique, civisme, règles de vie commune', icon: '⚖️' },
  { id: 'D4', code: 'D4', title: 'Les systèmes naturels et les systèmes techniques', desc: 'Démarche scientifique, SVT, Physique-Chimie, Techno', icon: '🔬' },
  { id: 'D5', code: 'D5', title: 'Les représentations du monde et l’activité humaine', desc: 'Histoire, Géographie, repères spatiaux et temporels', icon: '🗺️' }
];

export const NIVEAUX_MAITRISE = [
  { id: 'INSUFFISANT', label: 'Maîtrise insuffisante', points: 10, color: '#ef4444', icon: '🔴' },
  { id: 'FRAGILE', label: 'Maîtrise fragile', points: 25, color: '#f59e0b', icon: '🟠' },
  { id: 'SATISFAISANT', label: 'Maîtrise satisfaisante', points: 40, color: '#10b981', icon: '🟢' },
  { id: 'TRES_BON', label: 'Très bonne maîtrise', points: 50, color: '#8b5cf6', icon: '🌟' }
];

export default function SocleCommunManager({ classIdProp = null, schoolYearProp = '2023-2024' }) {
  const ctx = useContext(AiAdminContext);
  const { userRole, userData } = useUserRole();
  const isFamily = ['parent', 'eleve'].includes(userRole);

  const classes = ctx?.classes || [];
  const elevesAll = ctx?.eleves || [];

  const [selectedClassId, setSelectedClassId] = useState(classIdProp || (classes[0]?._id || ''));
  const [selectedAnnee, setSelectedAnnee] = useState(schoolYearProp);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Map des évaluations de la classe : { [eleveId]: { evaluations: { D1_1: 'SATISFAISANT', ... }, appreciationGlobale: '' } }
  const [socleMap, setSocleMap] = useState({});
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Formulaire temporaire pour l'élève actif
  const [tempEvaluations, setTempEvaluations] = useState({});
  const [tempAppreciation, setTempAppreciation] = useState('');

  useEffect(() => {
    if (classIdProp) setSelectedClassId(classIdProp);
  }, [classIdProp]);

  // Enfants rattachés à la famille
  const familyChildIds = useMemo(() => {
    if (!isFamily || !userData) return [];
    if (userRole === 'eleve' && userData.roleData?.eleveRef) {
      return [String(userData.roleData.eleveRef._id || userData.roleData.eleveRef)];
    }
    if (userRole === 'parent' && Array.isArray(userData.roleData?.childrenRefs)) {
      return userData.roleData.childrenRefs.map(c => String(c._id || c));
    }
    return [];
  }, [isFamily, userData, userRole]);

  // Auto-sélection de la classe pour le mode famille
  useEffect(() => {
    if (!isFamily || classIdProp || elevesAll.length === 0) return;
    if (familyChildIds.length > 0) {
      const child = elevesAll.find(e => familyChildIds.includes(String(e._id)));
      if (child?.current_classe) {
        setSelectedClassId(String(child.current_classe._id || child.current_classe));
        return;
      }
    }
    // Fallback : première classe de 3ème
    const classe3 = classes.find(c => c.niveau?.includes('3'));
    if (classe3) setSelectedClassId(String(classe3._id));
  }, [isFamily, elevesAll, familyChildIds, classes, classIdProp]);

  const currentClasse = classes.find(c => String(c._id) === String(selectedClassId));
  const elevesClasse = useMemo(() => {
    const all = elevesAll.filter(e => String(e.current_classe) === String(selectedClassId));
    if (isFamily && familyChildIds.length > 0) {
      const filtered = all.filter(e => familyChildIds.includes(String(e._id)));
      return filtered.length > 0 ? filtered : all;
    }
    return all;
  }, [elevesAll, selectedClassId, isFamily, familyChildIds]);

  // Auto-sélection du 1er élève
  useEffect(() => {
    if (elevesClasse.length > 0 && (!activeStudentId || !elevesClasse.some(e => String(e._id) === String(activeStudentId)))) {
      setActiveStudentId(elevesClasse[0]._id);
    }
  }, [elevesClasse, activeStudentId]);

  // Charger les données du socle commun
  const fetchSocleData = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(`/api/school_ai/socle?classeId=${selectedClassId}&annee=${selectedAnnee}`);
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur de chargement du socle');

      const map = {};
      if (Array.isArray(json.data)) {
        json.data.forEach(item => {
          map[item.eleveId] = {
            evaluations: item.evaluations || {},
            appreciationGlobale: item.appreciationGlobale || ''
          };
        });
      }
      setSocleMap(map);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedAnnee]);

  useEffect(() => {
    fetchSocleData();
  }, [fetchSocleData]);

  // Pré-remplir le formulaire temporaire quand l'élève actif change
  useEffect(() => {
    if (activeStudentId) {
      const existing = socleMap[activeStudentId];
      if (existing) {
        setTempEvaluations(existing.evaluations || {});
        setTempAppreciation(existing.appreciationGlobale || '');
      } else {
        setTempEvaluations({});
        setTempAppreciation('');
      }
    }
  }, [activeStudentId, socleMap]);

  // Calcul du score du socle (sur 400 points)
  const calculateScore = (evals) => {
    let total = 0;
    DOMAINES_SOCLE.forEach(d => {
      const niveauId = evals?.[d.id];
      const niv = NIVEAUX_MAITRISE.find(n => n.id === niveauId);
      if (niv) total += niv.points;
    });
    return total;
  };

  const handleSetNiveau = (domaineId, niveauId) => {
    setTempEvaluations(prev => ({
      ...prev,
      [domaineId]: niveauId
    }));
  };

  // Enregistrer pour l'élève actif
  const handleSaveStudentSocle = async () => {
    if (!activeStudentId) return;
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/school_ai/socle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eleveId: activeStudentId,
          annee: selectedAnnee,
          evaluations: tempEvaluations,
          appreciationGlobale: tempAppreciation
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur lors de la sauvegarde');

      setSocleMap(prev => ({
        ...prev,
        [activeStudentId]: {
          evaluations: tempEvaluations,
          appreciationGlobale: tempAppreciation
        }
      }));

      const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));
      setMessage({ type: 'success', text: `✅ Bilan du Socle Commun enregistré pour ${activeStudent?.nom} ${activeStudent?.prenoms?.[0] || ''} ! (${calculateScore(tempEvaluations)}/400 pts)` });
      setTimeout(() => setMessage(null), 3500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));
  const activeScore = calculateScore(tempEvaluations);
  const activeEvaluatedCount = Object.keys(tempEvaluations).length;

  return (
    <div className="socle-manager">
      {/* Barre de filtres */}
      <div className="socle-manager__toolbar">
        {!classIdProp && (
          <div className="socle-manager__field">
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

        <div className="socle-manager__field">
          <label>Année Scolaire :</label>
          <input
            type="text"
            value={selectedAnnee}
            onChange={e => setSelectedAnnee(e.target.value)}
            style={{ width: '110px' }}
          />
        </div>
      </div>

      {message && (
        <div className={`socle-manager__alert socle-manager__alert--${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="socle-manager__loading">Chargement des données du socle commun...</div>
      ) : !selectedClassId ? (
        <div className="socle-manager__empty">Veuillez sélectionner une classe.</div>
      ) : (
        <div className="socle-manager__body">
          {/* Section 1: Grille des élèves avec boutons icônes et progression */}
          <div className="socle-manager__section">
            <h4 className="socle-manager__section-title">
              🎓 Sélectionner un élève de la classe ({elevesClasse.length} élèves)
            </h4>
            <div className="socle-manager__icon-grid">
              {elevesClasse.map(eleve => {
                const isSelected = String(eleve._id) === String(activeStudentId);
                const evData = socleMap[eleve._id];
                const score = evData ? calculateScore(evData.evaluations) : 0;
                const isComplete = evData && Object.keys(evData.evaluations || {}).length === 8;

                return (
                  <button
                    key={eleve._id}
                    type="button"
                    className={`socle-icon-btn ${isSelected ? 'socle-icon-btn--selected' : ''} ${isComplete ? 'socle-icon-btn--complete' : ''}`}
                    onClick={() => setActiveStudentId(eleve._id)}
                  >
                    <div className="socle-icon-btn__avatar">
                      <img src={eleve.photo || '/school/classe.webp'} alt={eleve.nom} />
                      {isComplete && <span className="socle-icon-btn__badge">⭐</span>}
                    </div>
                    <span className="socle-icon-btn__name">{eleve.nom} {eleve.prenoms?.[0] || ''}.</span>
                    <span className="socle-icon-btn__score">{score} / 400 pts</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Formulaire d'évaluation du Socle (Carte Unique) */}
          {activeStudent && (
            <div className="socle-manager__section">
              <div className="socle-card-editor">
                <div className="socle-card-editor__header">
                  <div className="socle-card-editor__identity">
                    <img src={activeStudent.photo || '/school/classe.webp'} alt="" className="socle-card-editor__avatar" />
                    <div>
                      <h3>{activeStudent.nom} {activeStudent.prenoms?.join(' ')}</h3>
                      <div className="socle-card-editor__subtitle">Évaluation des 8 domaines du Socle Commun</div>
                    </div>
                  </div>

                  {/* Compteur de points en direct */}
                  <div className="socle-card-editor__score-box">
                    <div className="socle-card-editor__score-val">{activeScore} <span>/ 400 pts</span></div>
                    <div className="socle-card-editor__score-progress">
                      <div
                        className="socle-card-editor__score-bar"
                        style={{ width: `${(activeScore / 400) * 100}%` }}
                      />
                    </div>
                    <div className="socle-card-editor__count">{activeEvaluatedCount} / 8 domaines évalués</div>
                  </div>
                </div>

                {/* Grille des 8 Domaines de Compétences */}
                <div className="socle-domains-list">
                  {DOMAINES_SOCLE.map(domaine => {
                    const currentNiveau = tempEvaluations[domaine.id];
                    return (
                      <div key={domaine.id} className="socle-domain-item">
                        <div className="socle-domain-item__info">
                          <span className="socle-domain-item__icon">{domaine.icon}</span>
                          <div>
                            <strong><span className="socle-domain-item__code">{domaine.code}</span> — {domaine.title}</strong>
                            <p>{domaine.desc}</p>
                          </div>
                        </div>

                        {/* Choix du niveau de maîtrise */}
                        <div className="socle-domain-item__pills">
                          {NIVEAUX_MAITRISE.map(niv => {
                            const isChecked = currentNiveau === niv.id;
                            return (
                              <button
                                key={niv.id}
                                type="button"
                                className={`socle-pill ${isChecked ? 'socle-pill--active' : ''}`}
                                style={{ '--pill-color': niv.color }}
                                onClick={() => handleSetNiveau(domaine.id, niv.id)}
                              >
                                <span>{niv.icon}</span>
                                <span>{niv.label}</span>
                                <span className="socle-pill__pts">+{niv.points} pts</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Appréciation globale du socle */}
                <div className="socle-card-editor__appr">
                  <label>📝 Synthèse / Appréciation globale du Conseil sur le Socle Commun :</label>
                  <textarea
                    rows="3"
                    placeholder="Synthèse du bilan de fin de cycle 4 (3ème)..."
                    value={tempAppreciation}
                    onChange={e => setTempAppreciation(e.target.value)}
                  />
                </div>

                {/* Action d'enregistrement */}
                <div className="socle-card-editor__actions">
                  <button
                    type="button"
                    className="socle-card-editor__save-btn"
                    disabled={saving}
                    onClick={handleSaveStudentSocle}
                  >
                    {saving ? 'Enregistrement...' : `✅ Enregistrer le Bilan de ${activeStudent.nom} (${activeScore} pts)`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Tableau Récapitulatif de la classe */}
          <div className="socle-manager__section">
            <h4 className="socle-manager__section-title">📊 Synthèse du Socle pour la classe ({elevesClasse.length} élèves)</h4>
            <div className="socle-summary-table-wrapper">
              <table className="socle-summary-table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    {DOMAINES_SOCLE.map(d => (
                      <th key={d.id} title={d.title}>{d.code}</th>
                    ))}
                    <th>Total Socle</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {elevesClasse.map(e => {
                    const ev = socleMap[e._id]?.evaluations || {};
                    const score = calculateScore(ev);
                    return (
                      <tr key={e._id} className={String(e._id) === String(activeStudentId) ? 'socle-summary-table__tr--active' : ''}>
                        <td>
                          <strong>{e.nom} {e.prenoms?.[0]}.</strong>
                        </td>
                        {DOMAINES_SOCLE.map(d => {
                          const nivId = ev[d.id];
                          const niv = NIVEAUX_MAITRISE.find(n => n.id === nivId);
                          return (
                            <td key={d.id} style={{ textAlign: 'center' }}>
                              {niv ? (
                                <span title={`${d.code}: ${niv.label} (+${niv.points}pts)`}>
                                  {niv.icon}
                                </span>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>-</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          <span style={{ color: score >= 320 ? '#10b981' : score >= 200 ? '#f59e0b' : '#ef4444' }}>
                            {score} / 400 pts
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="socle-summary-table__edit-btn"
                            onClick={() => setActiveStudentId(e._id)}
                          >
                            ✏️ Éditer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

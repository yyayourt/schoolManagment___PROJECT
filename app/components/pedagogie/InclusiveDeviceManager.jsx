"use client";

import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import { useUserRole } from '../../../stores/useUserRole';
import './InclusiveDeviceManager.scss';

export const TYPES_DISPOSITIFS = [
  { id: 'PAP', label: 'PAP - Plan d\'Accompagnement Personnalisé', shortLabel: 'PAP', sub: 'Troubles DYS, TDAH', color: '#2563eb', icon: '📘' },
  { id: 'PPRE', label: 'PPRE - Programme Personnalisé de Réussite', shortLabel: 'PPRE', sub: 'Difficultés / Remédiation', color: '#f59e0b', icon: '🎯' },
  { id: 'PAI', label: 'PAI - Projet d\'Accueil Individualisé', shortLabel: 'PAI', sub: 'Santé, Allergies, Urgence', color: '#ef4444', icon: '💊' },
  { id: 'PPS', label: 'PPS - Projet Personnalisé de Scolarisation', shortLabel: 'PPS', sub: 'Handicap, MDPH, AESH', color: '#8b5cf6', icon: '♿' }
];

export const AMENAGEMENTS_SUGGESTIONS = [
  "⏱️ Temps majoré de 1/3 aux évaluations",
  "📄 Support aéré avec police adaptée (OpenDyslexic/Arial 12)",
  "🎧 Consignes lues à voix haute ou reformulées",
  "🧮 Calculatrice / Tables de Pythagore autorisées",
  "🤝 Présence d'un AESH en classe",
  "💻 Utilisation autorisée de l'ordinateur portable",
  "🚫 Ne pas pénaliser l'orthographe hors français",
  "🪑 Placement privilégié au 1er rang face au tableau",
  "💊 Panier repas personnel / Trousse de secours à l'infirmerie"
];

export default function InclusiveDeviceManager({ classIdProp = null, schoolYearProp = '2023-2024' }) {
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

  const [deviceMap, setDeviceMap] = useState({});
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Formulaire temporaire des dispositifs de l'élève actif
  const [tempDevices, setTempDevices] = useState([]);

  useEffect(() => {
    if (classIdProp) setSelectedClassId(classIdProp);
  }, [classIdProp]);

  // Si famille, trouver l'enfant rattaché
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
    if (!isFamily || elevesAll.length === 0) return;

    if (familyChildIds.length > 0) {
      const child = elevesAll.find(e => familyChildIds.includes(String(e._id)));
      if (child && child.current_classe) {
        setSelectedClassId(String(child.current_classe._id || child.current_classe));
        return;
      }
    }

    // Fallback Démo : cibler la 1ère classe avec des élèves
    if (classes.length > 0) {
      setSelectedClassId(String(classes[0]._id));
    }
  }, [isFamily, elevesAll, familyChildIds, classes]);

  const elevesClasse = useMemo(() => {
    const classStudents = elevesAll.filter(e => String(e.current_classe) === String(selectedClassId));
    if (isFamily && familyChildIds.length > 0) {
      const familyFiltered = classStudents.filter(e => familyChildIds.includes(String(e._id)));
      return familyFiltered.length > 0 ? familyFiltered : classStudents;
    }
    return classStudents;
  }, [elevesAll, selectedClassId, isFamily, familyChildIds]);

  // Sélection auto du 1er élève
  useEffect(() => {
    if (elevesClasse.length > 0 && (!activeStudentId || !elevesClasse.some(e => String(e._id) === String(activeStudentId)))) {
      setActiveStudentId(elevesClasse[0]._id);
    }
  }, [elevesClasse, activeStudentId]);

  // Charger les données des dispositifs de la classe
  const fetchInclusiveData = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(`/api/school_ai/inclusive_devices?classeId=${selectedClassId}&annee=${selectedAnnee}`);
      
      let json = {};
      try {
        json = await res.json();
      } catch (parseErr) {
        throw new Error(`Erreur serveur (${res.status} ${res.statusText})`);
      }

      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur de chargement des dispositifs');

      const map = {};
      if (Array.isArray(json.data)) {
        json.data.forEach(item => {
          map[item.eleveId] = item;
        });
      }
      setDeviceMap(map);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedAnnee]);

  useEffect(() => {
    fetchInclusiveData();
  }, [fetchInclusiveData]);

  // Pré-remplir le formulaire pour l'élève actif
  useEffect(() => {
    if (activeStudentId) {
      const existing = deviceMap[activeStudentId];
      if (existing && Array.isArray(existing.devices)) {
        setTempDevices(existing.devices.map(d => ({
          ...d,
          amenagementsPedagogiques: Array.isArray(d.amenagementsPedagogiques) ? d.amenagementsPedagogiques : []
        })));
      } else {
        setTempDevices([]);
      }
    }
  }, [activeStudentId, deviceMap]);

  // Gestion de l'ajout d'un dispositif
  const handleAddDevice = (typeId) => {
    if (tempDevices.some(d => d.type === typeId)) return;
    const typeObj = TYPES_DISPOSITIFS.find(t => t.id === typeId);
    setTempDevices(prev => [
      ...prev,
      {
        type: typeId,
        statut: 'ACTIF',
        diagnostiqueOuMotif: '',
        amenagementsPedagogiques: [],
        referentOuAesh: '',
        notesConfidentielles: ''
      }
    ]);
  };

  const handleRemoveDevice = (index) => {
    setTempDevices(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeviceChange = (index, field, value) => {
    setTempDevices(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const handleToggleAmenagement = (index, text) => {
    setTempDevices(prev => prev.map((d, i) => {
      if (i !== index) return d;
      const current = d.amenagementsPedagogiques || [];
      const exists = current.includes(text);
      const updated = exists ? current.filter(t => t !== text) : [...current, text];
      return { ...d, amenagementsPedagogiques: updated };
    }));
  };

  const handleAddCustomAmenagement = (index, text) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    setTempDevices(prev => prev.map((d, i) => {
      if (i !== index) return d;
      const current = d.amenagementsPedagogiques || [];
      if (current.includes(cleanText)) return d;
      return { ...d, amenagementsPedagogiques: [...current, cleanText] };
    }));
  };

  // Sauvegarde des dispositifs inclusifs
  const handleSaveDevices = async () => {
    if (!activeStudentId) return;
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/school_ai/inclusive_devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eleveId: activeStudentId,
          annee: selectedAnnee,
          devices: tempDevices
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur lors de la sauvegarde');

      setDeviceMap(prev => ({
        ...prev,
        [activeStudentId]: json.data
      }));

      const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));
      setMessage({ type: 'success', text: `✅ Dispositifs d'accompagnement mis à jour pour ${activeStudent?.nom} ${activeStudent?.prenoms?.[0] || ''} !` });
      setTimeout(() => setMessage(null), 3500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));

  return (
    <div className="inclusive-manager">
      {/* Toolbar */}
      <div className="inclusive-manager__toolbar">
        {!classIdProp && (
          <div className="inclusive-manager__field">
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

        <div className="inclusive-manager__field">
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
        <div className={`inclusive-manager__alert inclusive-manager__alert--${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="inclusive-manager__loading">Chargement des dispositifs inclusifs (PAP, PPRE, PAI, PPS)...</div>
      ) : !selectedClassId ? (
        <div className="inclusive-manager__empty">Veuillez sélectionner une classe.</div>
      ) : (
        <div className="inclusive-manager__body">
          {/* Section 1: Grille des élèves */}
          <div className="inclusive-manager__section">
            <h4 className="inclusive-manager__section-title">
              🤝 Équipe & Suivi Inclusif de la classe ({elevesClasse.length} élèves)
            </h4>
            <div className="inclusive-manager__icon-grid">
              {elevesClasse.map(eleve => {
                const isSelected = String(eleve._id) === String(activeStudentId);
                const data = deviceMap[eleve._id];
                const activeDevices = data?.devices?.filter(d => d.statut !== 'ARCHIVE') || [];

                return (
                  <button
                    key={eleve._id}
                    type="button"
                    className={`inclusive-icon-btn ${isSelected ? 'inclusive-icon-btn--selected' : ''}`}
                    onClick={() => setActiveStudentId(eleve._id)}
                  >
                    <div className="inclusive-icon-btn__avatar">
                      <img src={eleve.photo || '/school/classe.webp'} alt={eleve.nom} />
                      {activeDevices.length > 0 && (
                        <span className="inclusive-icon-btn__count-badge">{activeDevices.length}</span>
                      )}
                    </div>
                    <span className="inclusive-icon-btn__name">{eleve.nom} {eleve.prenoms?.[0] || ''}.</span>

                    <div className="inclusive-icon-btn__badges">
                      {activeDevices.length > 0 ? (
                        activeDevices.map(d => {
                          const typeObj = TYPES_DISPOSITIFS.find(t => t.id === d.type);
                          return (
                            <span
                              key={d.type}
                              className="inclusive-mini-badge"
                              style={{ background: typeObj?.color || '#64748b' }}
                            >
                              {typeObj?.icon} {d.type}
                            </span>
                          );
                        })
                      ) : (
                        <span className="inclusive-icon-btn__none">Sans dispositif</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Fiche & Formulaire de l'élève actif */}
          {activeStudent && (
            <div className="inclusive-manager__section">
              <div className="inclusive-card">
                <div className="inclusive-card__header">
                  <div className="inclusive-card__identity">
                    <img src={activeStudent.photo || '/school/classe.webp'} alt="" className="inclusive-card__avatar" />
                    <div>
                      <h3>{activeStudent.nom} {activeStudent.prenoms?.join(' ')}</h3>
                      <div className="inclusive-card__subtitle">Dispositifs d'Accompagnement & Aménagements Pédagogiques</div>
                    </div>
                  </div>

                  {/* Boutons d'ajout rapide de dispositif */}
                  <div className="inclusive-card__quick-add">
                    <span>➕ Activer un dispositif :</span>
                    <div className="inclusive-card__add-btns">
                      {TYPES_DISPOSITIFS.map(type => {
                        const isAlreadyActive = tempDevices.some(d => d.type === type.id);
                        return (
                          <button
                            key={type.id}
                            type="button"
                            className="inclusive-add-btn"
                            disabled={isAlreadyActive}
                            style={{ '--btn-color': type.color }}
                            onClick={() => handleAddDevice(type.id)}
                          >
                            {type.icon} + {type.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Synthèse rapide Enseignants s'il y a des aménagements */}
                {tempDevices.some(d => d.amenagementsPedagogiques?.length > 0) && (
                  <div className="inclusive-banner">
                    <div className="inclusive-banner__title">
                      📢 Synthèse des Aménagements en Classe pour l'Équipe Enseignante :
                    </div>
                    <ul className="inclusive-banner__list">
                      {tempDevices.flatMap(d => d.amenagementsPedagogiques || []).map((amenagement, idx) => (
                        <li key={idx}>{amenagement}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bloc des dispositifs de l'élève */}
                {tempDevices.length === 0 ? (
                  <div className="inclusive-card__no-device">
                    Aucun dispositif d'accompagnement (PAP, PPRE, PAI, PPS) actif pour cet élève.
                    <br />Utilisez les boutons ci-dessus pour ajouter un accompagnement spécifique.
                  </div>
                ) : (
                  tempDevices.map((device, idx) => {
                    const typeObj = TYPES_DISPOSITIFS.find(t => t.id === device.type) || TYPES_DISPOSITIFS[0];

                    return (
                      <div
                        key={idx}
                        className="inclusive-device-block"
                        style={{ borderLeftColor: typeObj.color }}
                      >
                        <div className="inclusive-device-block__header">
                          <div className="inclusive-device-block__title">
                            <span>{typeObj.icon}</span>
                            <strong>{typeObj.label}</strong>
                            <span className="inclusive-device-block__sub">({typeObj.sub})</span>
                          </div>

                          <div className="inclusive-device-block__header-right">
                            <select
                              value={device.statut}
                              onChange={e => handleDeviceChange(idx, 'statut', e.target.value)}
                              className="inclusive-device-block__status-select"
                            >
                              <option value="ACTIF">🟢 Actif</option>
                              <option value="EN_REVISION">🟠 En Révision</option>
                              <option value="ARCHIVE">⚪ Archivé</option>
                            </select>

                            <button
                              type="button"
                              className="inclusive-device-block__remove-btn"
                              onClick={() => handleRemoveDevice(idx)}
                              title="Retirer ce dispositif"
                            >
                              ❌
                            </button>
                          </div>
                        </div>

                        <div className="inclusive-device-block__body">
                          <div className="inclusive-card__grid-fields">
                            <div className="inclusive-card__field">
                              <label>Motif / Diagnostic médical ou pédagogique :</label>
                              <input
                                type="text"
                                placeholder="ex: Dyslexie sévère, Allergie arachide, Remédiation maths..."
                                value={device.diagnostiqueOuMotif}
                                onChange={e => handleDeviceChange(idx, 'diagnostiqueOuMotif', e.target.value)}
                              />
                            </div>

                            <div className="inclusive-card__field">
                              <label>Référent / Intervenant AESH ou Santé :</label>
                              <input
                                type="text"
                                placeholder="ex: M. Giraud (AESH), Dr. Lemoine (Médecin)..."
                                value={device.referentOuAesh}
                                onChange={e => handleDeviceChange(idx, 'referentOuAesh', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Cases à cocher des aménagements suggérés */}
                          <div className="inclusive-card__field" style={{ marginTop: '0.85rem' }}>
                            <label>Aménagements pédagogiques recommandés (Sélection rapide) :</label>
                            <div className="inclusive-suggestions-grid">
                              {AMENAGEMENTS_SUGGESTIONS.map((sugg, sIdx) => {
                                const isChecked = (device.amenagementsPedagogiques || []).includes(sugg);
                                return (
                                  <label key={sIdx} className="inclusive-checkbox-card">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleAmenagement(idx, sugg)}
                                    />
                                    <span>{sugg}</span>
                                  </label>
                                );
                              })}
                            </div>

                            {/* Aménagements personnalisés / hors liste */}
                            {((device.amenagementsPedagogiques || []).filter(a => !AMENAGEMENTS_SUGGESTIONS.includes(a))).length > 0 && (
                              <div style={{ marginTop: '0.6rem' }}>
                                <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Aménagements sur mesure ajoutés :</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                                  {(device.amenagementsPedagogiques || []).filter(a => !AMENAGEMENTS_SUGGESTIONS.includes(a)).map((customAmenagement, cIdx) => (
                                    <span key={cIdx} className="inclusive-custom-chip">
                                      📝 {customAmenagement}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAmenagement(idx, customAmenagement)}
                                        title="Supprimer cet aménagement"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Champ d'ajout d'aménagement personnalisé */}
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                              <input
                                type="text"
                                id={`custom-amenagement-${idx}`}
                                placeholder="➕ Saisir un aménagement sur mesure personnalisé..."
                                style={{ flex: 1, padding: '0.4rem 0.7rem', fontSize: '0.82rem' }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomAmenagement(idx, e.currentTarget.value);
                                    e.currentTarget.value = '';
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="inclusive-add-custom-btn"
                                onClick={(e) => {
                                  const input = document.getElementById(`custom-amenagement-${idx}`);
                                  if (input) {
                                    handleAddCustomAmenagement(idx, input.value);
                                    input.value = '';
                                  }
                                }}
                              >
                                + Ajouter
                              </button>
                            </div>
                          </div>

                          {!isFamily && (
                            <div className="inclusive-card__field" style={{ marginTop: '0.85rem' }}>
                              <label>Notes & observations confidentielles (Réservé à l'équipe pédagogique) :</label>
                              <textarea
                                rows="2"
                                placeholder="Bilan des synthèses, consignes particulières, dates d'ESS..."
                                value={device.notesConfidentielles}
                                onChange={e => handleDeviceChange(idx, 'notesConfidentielles', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Action de sauvegarde (masquée en mode famille purement consultatif) */}
                {!isFamily && (
                  <div className="inclusive-card__actions">
                    <button
                      type="button"
                      className="inclusive-card__save-btn"
                      disabled={saving}
                      onClick={handleSaveDevices}
                    >
                      {saving ? 'Enregistrement...' : `💾 Enregistrer les Dispositifs Inclusifs de ${activeStudent.nom}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Tableau Récapitulatif de Classe (Masqué pour les familles) */}
          {!isFamily && (
            <div className="inclusive-manager__section">
              <h4 className="inclusive-manager__section-title">📊 Registre des Aménagements Inclusifs de la Classe</h4>
            <div className="inclusive-table-wrapper">
              <table className="inclusive-table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Dispositifs Actifs</th>
                    <th>Motif / Diagnostic</th>
                    <th>Aménagements en Classe</th>
                    <th>Référent / AESH</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {elevesClasse.map(e => {
                    const data = deviceMap[e._id];
                    const activeDevices = data?.devices?.filter(d => d.statut !== 'ARCHIVE') || [];

                    return (
                      <tr key={e._id} className={String(e._id) === String(activeStudentId) ? 'inclusive-table__tr--active' : ''}>
                        <td><strong>{e.nom} {e.prenoms?.[0]}.</strong></td>
                        <td>
                          {activeDevices.length > 0 ? (
                            <div className="inclusive-table__badges">
                              {activeDevices.map(d => {
                                const typeObj = TYPES_DISPOSITIFS.find(t => t.id === d.type);
                                return (
                                  <span key={d.type} className="inclusive-table__badge" style={{ background: typeObj?.color }}>
                                    {typeObj?.icon} {d.type}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Aucun</span>
                          )}
                        </td>
                        <td>
                          {activeDevices.length > 0 ? (
                            activeDevices.map((d, i) => (
                              <div key={i} style={{ fontSize: '0.8rem' }}>• {d.diagnostiqueOuMotif || 'Non renseigné'}</div>
                            ))
                          ) : '-'}
                        </td>
                        <td>
                          {activeDevices.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem' }}>
                              {activeDevices.flatMap(d => d.amenagementsPedagogiques || []).slice(0, 3).map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                              {activeDevices.flatMap(d => d.amenagementsPedagogiques || []).length > 3 && (
                                <li style={{ fontStyle: 'italic', color: '#64748b' }}>+ autres aménagements...</li>
                              )}
                            </ul>
                          ) : '-'}
                        </td>
                        <td>
                          {activeDevices.length > 0 ? (
                            activeDevices.map((d, i) => (
                              <div key={i} style={{ fontSize: '0.8rem' }}>{d.referentOuAesh || '-'}</div>
                            ))
                          ) : '-'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="inclusive-table__edit-btn"
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
          )}
        </div>
      )}
    </div>
  );
}

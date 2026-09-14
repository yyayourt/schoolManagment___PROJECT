"use client";

import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import { useUserRole } from '../../../stores/useUserRole';
import './OrientationManager.scss';

export const VOIES_ORIENTATION = [
  { id: '2NDE_GT', label: '2nde Générale & Technologique', shortLabel: '2nde GT', color: '#2563eb', icon: '🎓' },
  { id: '2NDE_PRO', label: '2nde Professionnelle (Bac Pro)', shortLabel: '2nde Pro', color: '#f59e0b', icon: '🛠️' },
  { id: 'CAP', label: '1ère année de CAP', shortLabel: 'CAP', color: '#10b981', icon: '🔧' },
  { id: 'APPRENTISSAGE', label: 'Apprentissage / CFA', shortLabel: 'CFA', color: '#8b5cf6', icon: '💼' },
  { id: 'AUTRE', label: 'Autre / Redoublement', shortLabel: 'Autre', color: '#64748b', icon: '❓' },
];

export const AVIS_CONSEIL = [
  { id: 'TRES_FAVORABLE', label: 'Très Favorable', color: '#10b981', icon: '🟢' },
  { id: 'FAVORABLE', label: 'Favorable', color: '#2563eb', icon: '🔵' },
  { id: 'RESERVE', label: 'Avis Réservé', color: '#f59e0b', icon: '🟠' },
  { id: 'DEFAVORABLE', label: 'Défavorable', color: '#ef4444', icon: '🔴' },
  { id: 'EN_ATTENTE', label: 'En attente', color: '#64748b', icon: '⏳' }
];

export default function OrientationManager({ classIdProp = null, schoolYearProp = '2023-2024' }) {
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

  const [orientationMap, setOrientationMap] = useState({});
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Formulaire temporaire d'orientation pour l'élève actif
  const [tempVoeux, setTempVoeux] = useState([
    { ordre: 1, voie: '2NDE_GT', specialiteOuEtablissement: '', statut: 'PROVISOIRE' }
  ]);
  const [tempAvis, setTempAvis] = useState({ avis: 'EN_ATTENTE', commentaire: '' });
  const [tempDecision, setTempDecision] = useState({ voieRetenue: 'EN_ATTENTE', accordFamille: false });
  const [tempEntretien, setTempEntretien] = useState({ realise: false, dateEntretien: '', compteRendu: '' });

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

    // Fallback Démo : trouver la première classe de 3ème
    const classe3eme = classes.find(c => c.niveau?.includes('3'));
    if (classe3eme) {
      setSelectedClassId(String(classe3eme._id));
    }
  }, [isFamily, elevesAll, familyChildIds, classes]);

  const currentClasse = classes.find(c => String(c._id) === String(selectedClassId));
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

  // Charger les données d'orientation de la classe
  const fetchOrientationData = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(`/api/school_ai/orientation?classeId=${selectedClassId}&annee=${selectedAnnee}`);
      
      let json = {};
      try {
        json = await res.json();
      } catch (parseErr) {
        throw new Error(`Erreur serveur (${res.status} ${res.statusText})`);
      }

      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur de chargement de l\'orientation');

      const map = {};
      if (Array.isArray(json.data)) {
        json.data.forEach(item => {
          map[item.eleveId] = item;
        });
      }
      setOrientationMap(map);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedAnnee]);

  useEffect(() => {
    fetchOrientationData();
  }, [fetchOrientationData]);

  // Pré-remplir le formulaire pour l'élève actif
  useEffect(() => {
    if (activeStudentId) {
      const existing = orientationMap[activeStudentId];
      if (existing) {
        setTempVoeux(existing.voeuxFamille?.length ? existing.voeuxFamille : [
          { ordre: 1, voie: '2NDE_GT', specialiteOuEtablissement: '', statut: 'PROVISOIRE' }
        ]);
        setTempAvis(existing.avisConseilClasse || { avis: 'EN_ATTENTE', commentaire: '' });
        setTempDecision(existing.decisionChefEtablissement || { voieRetenue: 'EN_ATTENTE', accordFamille: false });
        setTempEntretien({
          realise: existing.entretienOrientation?.realise || false,
          dateEntretien: existing.entretienOrientation?.dateEntretien ? new Date(existing.entretienOrientation.dateEntretien).toISOString().substring(0, 10) : '',
          compteRendu: existing.entretienOrientation?.compteRendu || ''
        });
      } else {
        setTempVoeux([{ ordre: 1, voie: '2NDE_GT', specialiteOuEtablissement: '', statut: 'PROVISOIRE' }]);
        setTempAvis({ avis: 'EN_ATTENTE', commentaire: '' });
        setTempDecision({ voieRetenue: 'EN_ATTENTE', accordFamille: false });
        setTempEntretien({ realise: false, dateEntretien: '', compteRendu: '' });
      }
    }
  }, [activeStudentId, orientationMap]);

  // Gestion des vœux
  const handleAddVoeu = () => {
    if (tempVoeux.length >= 3) return;
    setTempVoeux(prev => [
      ...prev,
      { ordre: prev.length + 1, voie: '2NDE_GT', specialiteOuEtablissement: '', statut: 'PROVISOIRE' }
    ]);
  };

  const handleRemoveVoeu = (index) => {
    setTempVoeux(prev => prev.filter((_, i) => i !== index).map((v, idx) => ({ ...v, ordre: idx + 1 })));
  };

  const handleVoeuChange = (index, field, value) => {
    setTempVoeux(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  // Enregistrer le dossier d'orientation
  const handleSaveOrientation = async () => {
    if (!activeStudentId) return;
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/school_ai/orientation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eleveId: activeStudentId,
          annee: selectedAnnee,
          voeuxFamille: tempVoeux,
          avisConseilClasse: tempAvis,
          decisionChefEtablissement: tempDecision,
          entretienOrientation: {
            ...tempEntretien,
            dateEntretien: tempEntretien.dateEntretien ? new Date(tempEntretien.dateEntretien) : null
          }
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur lors de la sauvegarde');

      setOrientationMap(prev => ({
        ...prev,
        [activeStudentId]: json.data
      }));

      const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));
      setMessage({ type: 'success', text: `✅ Dossier d'orientation mis à jour pour ${activeStudent?.nom} ${activeStudent?.prenoms?.[0] || ''} !` });
      setTimeout(() => setMessage(null), 3500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));

  return (
    <div className="orientation-manager">
      {/* Toolbar */}
      <div className="orientation-manager__toolbar">
        {!classIdProp && (
          <div className="orientation-manager__field">
            <label>Classe (3ème) :</label>
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

        <div className="orientation-manager__field">
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
        <div className={`orientation-manager__alert orientation-manager__alert--${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="orientation-manager__loading">Chargement des dossiers d'orientation...</div>
      ) : !selectedClassId ? (
        <div className="orientation-manager__empty">Veuillez sélectionner une classe.</div>
      ) : (
        <div className="orientation-manager__body">
          {/* Section 1: Grille des élèves */}
          <div className="orientation-manager__section">
            <h4 className="orientation-manager__section-title">
              🎓 Sélectionner un élève de 3ème ({elevesClasse.length} élèves)
            </h4>
            <div className="orientation-manager__icon-grid">
              {elevesClasse.map(eleve => {
                const isSelected = String(eleve._id) === String(activeStudentId);
                const data = orientationMap[eleve._id];
                const premiereVoieId = data?.voeuxFamille?.[0]?.voie || 'AUTRE';
                const voieObj = VOIES_ORIENTATION.find(v => v.id === premiereVoieId) || VOIES_ORIENTATION[4];
                const avisObj = AVIS_CONSEIL.find(a => a.id === data?.avisConseilClasse?.avis) || AVIS_CONSEIL[4];

                return (
                  <button
                    key={eleve._id}
                    type="button"
                    className={`orientation-icon-btn ${isSelected ? 'orientation-icon-btn--selected' : ''}`}
                    onClick={() => setActiveStudentId(eleve._id)}
                  >
                    <div className="orientation-icon-btn__avatar">
                      <img src={eleve.photo || '/school/classe.webp'} alt={eleve.nom} />
                      <span className="orientation-icon-btn__badge">{avisObj.icon}</span>
                    </div>
                    <span className="orientation-icon-btn__name">{eleve.nom} {eleve.prenoms?.[0] || ''}.</span>
                    <span className="orientation-icon-btn__voie" style={{ background: voieObj.color }}>
                      {voieObj.icon} {voieObj.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Formulaire d'Édition du Dossier d'Orientation */}
          {activeStudent && (
            <div className="orientation-manager__section">
              <div className="orientation-card">
                <div className="orientation-card__header">
                  <div className="orientation-card__identity">
                    <img src={activeStudent.photo || '/school/classe.webp'} alt="" className="orientation-card__avatar" />
                    <div>
                      <h3>{activeStudent.nom} {activeStudent.prenoms?.join(' ')}</h3>
                      <div className="orientation-card__subtitle">Dossier d'Orientation Post-3ème</div>
                    </div>
                  </div>
                </div>

                {/* Bloc 1: Vœux exprimés par l'élève / la famille */}
                <div className="orientation-card__block">
                  <div className="orientation-card__block-header">
                    <h4>📋 1. Vœux d'Orientation de la Famille</h4>
                    {tempVoeux.length < 3 && (
                      <button type="button" className="orientation-card__add-voeu-btn" onClick={handleAddVoeu}>
                        ➕ Ajouter un Vœu
                      </button>
                    )}
                  </div>

                  <div className="orientation-voeux-list">
                    {tempVoeux.map((voeu, idx) => (
                      <div key={idx} className="orientation-voeu-item">
                        <span className="orientation-voeu-item__num">Vœu {voeu.ordre}</span>

                        <div className="orientation-voeu-item__field">
                          <label>Voie d'orientation :</label>
                          <select
                            value={voeu.voie}
                            onChange={e => handleVoeuChange(idx, 'voie', e.target.value)}
                          >
                            {VOIES_ORIENTATION.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.icon} {v.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="orientation-voeu-item__field" style={{ flex: 1 }}>
                          <label>Spécialité / Lycée Cible :</label>
                          <input
                            type="text"
                            placeholder="ex: Lycée Carnot - Option Arts Plastiques..."
                            value={voeu.specialiteOuEtablissement}
                            onChange={e => handleVoeuChange(idx, 'specialiteOuEtablissement', e.target.value)}
                          />
                        </div>

                        <div className="orientation-voeu-item__field">
                          <label>Statut :</label>
                          <select
                            value={voeu.statut}
                            onChange={e => handleVoeuChange(idx, 'statut', e.target.value)}
                          >
                            <option value="PROVISOIRE">Provisoire (T2)</option>
                            <option value="DEFINITIF">Définitif (T3)</option>
                          </select>
                        </div>

                        {tempVoeux.length > 1 && (
                          <button
                            type="button"
                            className="orientation-voeu-item__remove-btn"
                            onClick={() => handleRemoveVoeu(idx)}
                            title="Supprimer ce vœu"
                          >
                            ❌
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bloc 2: Avis du Conseil de Classe & Professeur Principal */}
                <div className="orientation-card__block">
                  <h4>🏛️ 2. Avis du Conseil de Classe & Professeur Principal</h4>
                  {isFamily ? (
                    <div>
                      {(() => {
                        const avisObj = AVIS_CONSEIL.find(a => a.id === tempAvis.avis) || AVIS_CONSEIL[4];
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.4rem 0' }}>
                            <span style={{ background: avisObj.color, color: '#fff', padding: '0.3rem 0.75rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.85rem' }}>
                              {avisObj.icon} {avisObj.label}
                            </span>
                          </div>
                        );
                      })()}
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#334155' }}>
                        <b>Commentaire du Conseil :</b> {tempAvis.commentaire || <i>Aucun commentaire saisi pour le moment.</i>}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="orientation-card__pills">
                        {AVIS_CONSEIL.map(avis => {
                          const isSelected = tempAvis.avis === avis.id;
                          return (
                            <button
                              key={avis.id}
                              type="button"
                              className={`orientation-pill ${isSelected ? 'orientation-pill--active' : ''}`}
                              style={{ '--pill-color': avis.color }}
                              onClick={() => setTempAvis(prev => ({ ...prev, avis: avis.id }))}
                            >
                              <span>{avis.icon}</span>
                              <span>{avis.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="orientation-card__field" style={{ marginTop: '0.75rem' }}>
                        <label>Commentaire du Professeur Principal sur l'orientation :</label>
                        <textarea
                          rows="2"
                          placeholder="Commentaires du conseil sur la faisabilité des vœux et préconisations..."
                          value={tempAvis.commentaire}
                          onChange={e => setTempAvis(prev => ({ ...prev, commentaire: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Bloc 3: Entretien d'Orientation avec la famille */}
                <div className="orientation-card__block">
                  <h4>💬 3. Entretien Individuel d'Orientation</h4>
                  {isFamily ? (
                    <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                      <p><b>Statut :</b> {tempEntretien.realise ? `✅ Réalisé le ${tempEntretien.dateEntretien || 'Date non précisée'}` : '⏳ Entretien non encore planifié ou effectué'}</p>
                      {tempEntretien.realise && tempEntretien.compteRendu && (
                        <p style={{ marginTop: '0.4rem' }}><b>Compte-rendu :</b> {tempEntretien.compteRendu}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="orientation-card__flex-row">
                        <label className="orientation-checkbox-label">
                          <input
                            type="checkbox"
                            checked={tempEntretien.realise}
                            onChange={e => setTempEntretien(prev => ({ ...prev, realise: e.target.checked }))}
                          />
                          <span>Entretien d'orientation réalisé avec l'élève & la famille</span>
                        </label>

                        {tempEntretien.realise && (
                          <div className="orientation-card__field">
                            <label>Date de l'entretien :</label>
                            <input
                              type="date"
                              value={tempEntretien.dateEntretien}
                              onChange={e => setTempEntretien(prev => ({ ...prev, dateEntretien: e.target.value }))}
                            />
                          </div>
                        )}
                      </div>

                      {tempEntretien.realise && (
                        <div className="orientation-card__field" style={{ marginTop: '0.75rem' }}>
                          <label>Compte-rendu de l'entretien d'orientation :</label>
                          <textarea
                            rows="2"
                            placeholder="Accords trouvés, questions en suspens, visites de lycées prévues..."
                            value={tempEntretien.compteRendu}
                            onChange={e => setTempEntretien(prev => ({ ...prev, compteRendu: e.target.value }))}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Bloc 4: Décision Finale du Chef d'Établissement */}
                <div className="orientation-card__block orientation-card__block--decision">
                  <h4>👔 4. Décision d'Orientation du Principal (Chef d'Établissement)</h4>
                  {isFamily ? (
                    <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                      {(() => {
                        const vObj = VOIES_ORIENTATION.find(v => v.id === tempDecision.voieRetenue);
                        return (
                          <div>
                            <p><b>Voie retenue par la direction :</b> {vObj ? `${vObj.icon} ${vObj.label}` : '⏳ En attente de décision du conseil du T3'}</p>
                            <p style={{ marginTop: '0.3rem' }}><b>Accord famille :</b> {tempDecision.accordFamille ? '✅ Accord donné' : '⏳ En attente de confirmation'}</p>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="orientation-card__flex-row">
                      <div className="orientation-card__field" style={{ flex: 1 }}>
                        <label>Voie d'orientation retenue :</label>
                        <select
                          value={tempDecision.voieRetenue}
                          onChange={e => setTempDecision(prev => ({ ...prev, voieRetenue: e.target.value }))}
                        >
                          <option value="EN_ATTENTE">-- En attente de décision --</option>
                          {VOIES_ORIENTATION.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.icon} {v.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="orientation-checkbox-label" style={{ marginTop: '1.25rem' }}>
                        <input
                          type="checkbox"
                          checked={tempDecision.accordFamille}
                          onChange={e => setTempDecision(prev => ({ ...prev, accordFamille: e.target.checked }))}
                        />
                        <span>Accord de la famille obtenu</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Action de sauvegarde */}
                <div className="orientation-card__actions">
                  <button
                    type="button"
                    className="orientation-card__save-btn"
                    disabled={saving}
                    onClick={handleSaveOrientation}
                  >
                    {saving ? 'Enregistrement...' : isFamily ? `✅ Valider et Transmettre les Vœux de ${activeStudent.nom}` : `✅ Enregistrer le Dossier d'Orientation de ${activeStudent.nom}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Tableau récapitulatif de la classe (masqué pour les familles) */}
          {!isFamily && (
            <div className="orientation-manager__section">
              <h4 className="orientation-manager__section-title">📊 Synthèse de l'Orientation de la Classe ({elevesClasse.length} élèves)</h4>
            <div className="orientation-table-wrapper">
              <table className="orientation-table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Vœu n°1 (Famille)</th>
                    <th>Avis Conseil</th>
                    <th>Entretien</th>
                    <th>Décision Final</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {elevesClasse.map(e => {
                    const data = orientationMap[e._id];
                    const voeu1 = data?.voeuxFamille?.[0];
                    const voieObj = VOIES_ORIENTATION.find(v => v.id === voeu1?.voie) || VOIES_ORIENTATION[4];
                    const avisObj = AVIS_CONSEIL.find(a => a.id === data?.avisConseilClasse?.avis) || AVIS_CONSEIL[4];
                    const decisionVoie = VOIES_ORIENTATION.find(v => v.id === data?.decisionChefEtablissement?.voieRetenue);

                    return (
                      <tr key={e._id} className={String(e._id) === String(activeStudentId) ? 'orientation-table__tr--active' : ''}>
                        <td><strong>{e.nom} {e.prenoms?.[0]}.</strong></td>
                        <td>
                          {voeu1 ? (
                            <span>{voieObj.icon} {voieObj.label} {voeu1.specialiteOuEtablissement ? `(${voeu1.specialiteOuEtablissement})` : ''}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Aucun vœu</span>
                          )}
                        </td>
                        <td>
                          <span className="orientation-table__badge" style={{ background: avisObj.color }}>
                            {avisObj.icon} {avisObj.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {data?.entretienOrientation?.realise ? '✅ Fait' : '⏳ En attente'}
                        </td>
                        <td>
                          {decisionVoie ? (
                            <strong>{decisionVoie.icon} {decisionVoie.label}</strong>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>En attente</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="orientation-table__edit-btn"
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

"use client";

import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import { useUserRole } from '../../../stores/useUserRole';
import { DOMAINES_SOCLE, NIVEAUX_MAITRISE } from './SocleCommunManager';
import './DnbSimulator.scss';

export function getMentionInfo(scoreTotal) {
  if (scoreTotal >= 640) return { id: 'TRES_BIEN', label: '🌟 Mention TRÈS BIEN', color: '#8b5cf6', badge: '🌟', minPts: 640, nextPts: null, nextLabel: '' };
  if (scoreTotal >= 560) return { id: 'BIEN', label: '🏆 Mention BIEN', color: '#10b981', badge: '🏆', minPts: 560, nextPts: 640, nextLabel: 'Très Bien' };
  if (scoreTotal >= 480) return { id: 'ASSEZ_BIEN', label: '👏 Mention ASSEZ BIEN', color: '#2563eb', badge: '👏', minPts: 480, nextPts: 560, nextLabel: 'Bien' };
  if (scoreTotal >= 400) return { id: 'ADMIS', label: '✅ ADMIS (Sans mention)', color: '#059669', badge: '✅', minPts: 400, nextPts: 480, nextLabel: 'Assez Bien' };
  return { id: 'REFUSE', label: '❌ Non Admis (Insuffisant)', color: '#ef4444', badge: '❌', minPts: 0, nextPts: 400, nextLabel: 'Admis (400 pts)' };
}

export default function DnbSimulator({ classIdProp = null, schoolYearProp = '2023-2024' }) {
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

  const [dnbMap, setDnbMap] = useState({}); // { [eleveId]: { dnb: {}, socle: {} } }
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Formulaire temporaire d'épreuves pour l'élève actif
  const [tempEpreuves, setTempEpreuves] = useState({
    francais: 70,
    mathematiques: 70,
    histoireGeo: 35,
    sciences: 35,
    oral: 80,
    optionBonus: 0
  });
  const [tempSocleOverride, setTempSocleOverride] = useState('');
  const [tempCommentaires, setTempCommentaires] = useState('');

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

  // Charger les données DNB & Socle de la classe
  const fetchDnbData = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(`/api/school_ai/dnb?classeId=${selectedClassId}&annee=${selectedAnnee}`);
      const json = await res.json();

      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur chargement DNB');

      const map = {};
      const { dnbList = [], socleList = [] } = json.data || {};

      dnbList.forEach(d => {
        if (!map[d.eleveId]) map[d.eleveId] = { dnb: d, socle: null };
        else map[d.eleveId].dnb = d;
      });

      socleList.forEach(s => {
        if (!map[s.eleveId]) map[s.eleveId] = { dnb: null, socle: s };
        else map[s.eleveId].socle = s;
      });

      setDnbMap(map);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedAnnee]);

  useEffect(() => {
    fetchDnbData();
  }, [fetchDnbData]);

  // Calcul du score du socle depuis l'objet socle
  const computeSocleScore = (socleObj) => {
    if (!socleObj || !socleObj.evaluations) return 0;
    let pts = 0;
    DOMAINES_SOCLE.forEach(d => {
      const nivId = socleObj.evaluations[d.id];
      const niv = NIVEAUX_MAITRISE.find(n => n.id === nivId);
      if (niv) pts += niv.points;
    });
    return pts;
  };

  // Pré-remplir le formulaire pour l'élève actif
  useEffect(() => {
    if (activeStudentId) {
      const data = dnbMap[activeStudentId];
      if (data?.dnb) {
        setTempEpreuves(data.dnb.epreuves || {
          francais: 70, mathematiques: 70, histoireGeo: 35, sciences: 35, oral: 80, optionBonus: 0
        });
        setTempSocleOverride(data.dnb.ptsSocleCustom !== null && data.dnb.ptsSocleCustom !== undefined ? String(data.dnb.ptsSocleCustom) : '');
        setTempCommentaires(data.dnb.commentaires || '');
      } else {
        const defaultSoclePts = computeSocleScore(data?.socle);
        setTempEpreuves({
          francais: 70, mathematiques: 70, histoireGeo: 35, sciences: 35, oral: 80, optionBonus: 0
        });
        setTempSocleOverride('');
        setTempCommentaires('');
      }
    }
  }, [activeStudentId, dnbMap]);

  // Calcul des sous-totaux en temps réel
  const activeStudentData = dnbMap[activeStudentId];
  const autoSoclePts = computeSocleScore(activeStudentData?.socle);
  const effectiveSoclePts = tempSocleOverride !== '' ? Number(tempSocleOverride) : autoSoclePts;

  const totalEpreuvesPts = (Number(tempEpreuves.francais) || 0) +
                           (Number(tempEpreuves.mathematiques) || 0) +
                           (Number(tempEpreuves.histoireGeo) || 0) +
                           (Number(tempEpreuves.sciences) || 0) +
                           (Number(tempEpreuves.oral) || 0) +
                           (Number(tempEpreuves.optionBonus) || 0);

  const grandTotalDnb = effectiveSoclePts + totalEpreuvesPts;
  const mentionInfo = getMentionInfo(grandTotalDnb);

  const handleEpreuveChange = (key, val) => {
    const num = Math.max(0, Number(val) || 0);
    setTempEpreuves(prev => ({
      ...prev,
      [key]: num
    }));
  };

  // Sauvegarde des prédictions DNB de l'élève
  const handleSaveDnb = async () => {
    if (!activeStudentId) return;
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/school_ai/dnb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eleveId: activeStudentId,
          annee: selectedAnnee,
          epreuves: tempEpreuves,
          ptsSocleCustom: tempSocleOverride !== '' ? Number(tempSocleOverride) : null,
          commentaires: tempCommentaires
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur de sauvegarde');

      setDnbMap(prev => ({
        ...prev,
        [activeStudentId]: {
          ...prev[activeStudentId],
          dnb: json.data
        }
      }));

      const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));
      setMessage({ type: 'success', text: `💾 Simulation DNB enregistrée pour ${activeStudent?.nom} ${activeStudent?.prenoms?.[0] || ''} ! (${grandTotalDnb}/800 pts - ${mentionInfo.label})` });
      setTimeout(() => setMessage(null), 3500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));

  return (
    <div className="dnb-simulator">
      {/* Barre de filtres */}
      <div className="dnb-simulator__toolbar">
        {!classIdProp && (
          <div className="dnb-simulator__field">
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

        <div className="dnb-simulator__field">
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
        <div className={`dnb-simulator__alert dnb-simulator__alert--${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="dnb-simulator__loading">Chargement du simulateur DNB...</div>
      ) : !selectedClassId ? (
        <div className="dnb-simulator__empty">Veuillez sélectionner une classe.</div>
      ) : (
        <div className="dnb-simulator__body">
          {/* Section 1: Grille des boutons d'icônes d'élèves */}
          <div className="dnb-simulator__section">
            <h4 className="dnb-simulator__section-title">
              🎓 Élèves de la classe ({elevesClasse.length} candidats)
            </h4>
            <div className="dnb-simulator__icon-grid">
              {elevesClasse.map(eleve => {
                const isSelected = String(eleve._id) === String(activeStudentId);
                const data = dnbMap[eleve._id];
                const soclePts = computeSocleScore(data?.socle);
                const dnbObj = data?.dnb;
                const totalPts = dnbObj ? dnbObj.noteFinalCalculated : soclePts + 280; // estimation par défaut
                const mInfo = getMentionInfo(totalPts);

                return (
                  <button
                    key={eleve._id}
                    type="button"
                    className={`dnb-icon-btn ${isSelected ? 'dnb-icon-btn--selected' : ''}`}
                    onClick={() => setActiveStudentId(eleve._id)}
                  >
                    <div className="dnb-icon-btn__avatar">
                      <img src={eleve.photo || '/school/classe.webp'} alt={eleve.nom} />
                      <span className="dnb-icon-btn__badge">{mInfo.badge}</span>
                    </div>
                    <span className="dnb-icon-btn__name">{eleve.nom} {eleve.prenoms?.[0] || ''}.</span>
                    <span className="dnb-icon-btn__pts" style={{ color: mInfo.color }}>
                      {totalPts} / 800
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Simulateur en Temps Réel (Carte d'Édition) */}
          {activeStudent && (
            <div className="dnb-simulator__section">
              <div className="dnb-card">
                {/* En-tête de la carte avec l'identité et la Jauge finale */}
                <div className="dnb-card__header">
                  <div className="dnb-card__identity">
                    <img src={activeStudent.photo || '/school/classe.webp'} alt="" className="dnb-card__avatar" />
                    <div>
                      <h3>{activeStudent.nom} {activeStudent.prenoms?.join(' ')}</h3>
                      <div className="dnb-card__subtitle">Simulateur officiel du Diplôme National du Brevet (DNB)</div>
                    </div>
                  </div>

                  {/* Jauge de Mention finale */}
                  <div className="dnb-card__badge-box" style={{ borderColor: mentionInfo.color }}>
                    <div className="dnb-card__badge-title" style={{ color: mentionInfo.color }}>
                      {mentionInfo.label}
                    </div>
                    <div className="dnb-card__badge-score">
                      {grandTotalDnb} <span>/ 800 pts</span>
                    </div>

                    {mentionInfo.nextPts && (
                      <div className="dnb-card__badge-next">
                        💡 Plus que <strong>{mentionInfo.nextPts - grandTotalDnb} pts</strong> pour viser la <em>Mention {mentionInfo.nextLabel}</em> !
                      </div>
                    )}
                  </div>
                </div>

                {/* Bloc 1: Socle Commun de Compétences (400 points) */}
                <div className="dnb-card__block dnb-card__block--socle">
                  <div className="dnb-card__block-title">
                    <span>1️⃣ Socle Commun de Compétences (400 points max)</span>
                    <strong className="dnb-card__block-pts">{effectiveSoclePts} / 400 pts</strong>
                  </div>

                  <div className="dnb-card__socle-detail">
                    {autoSoclePts > 0 ? (
                      <div className="dnb-card__socle-auto">
                        ✅ Score calculé automatiquement depuis l'Étape 5.1 (Bilan du Socle) : <strong>{autoSoclePts} / 400 pts</strong>.
                      </div>
                    ) : (
                      <div className="dnb-card__socle-auto dnb-card__socle-auto--warn">
                        ⚠️ Aucun bilan de socle renseigné pour l'instant (0 pts). Vous pouvez forcer un total ci-dessous :
                      </div>
                    )}

                    <div className="dnb-card__socle-override">
                      <label>Surcharger manuellement les points du socle (0 à 400 pts) :</label>
                      <input
                        type="number"
                        min="0"
                        max="400"
                        placeholder={`Automatique (${autoSoclePts} pts)`}
                        value={tempSocleOverride}
                        onChange={e => setTempSocleOverride(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Bloc 2: Épreuves Finales du Brevet (400 points) */}
                <div className="dnb-card__block dnb-card__block--epreuves">
                  <div className="dnb-card__block-title">
                    <span>2️⃣ Épreuves Finales d'Examen (400 points max + options)</span>
                    <strong className="dnb-card__block-pts">{totalEpreuvesPts} / 400 pts</strong>
                  </div>

                  <div className="dnb-epreuves-grid">
                    <div className="dnb-epreuve-item">
                      <label>📘 Français (sur 100 pts) :</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tempEpreuves.francais}
                        onChange={e => handleEpreuveChange('francais', e.target.value)}
                      />
                    </div>

                    <div className="dnb-epreuve-item">
                      <label>📐 Mathématiques (sur 100 pts) :</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tempEpreuves.mathematiques}
                        onChange={e => handleEpreuveChange('mathematiques', e.target.value)}
                      />
                    </div>

                    <div className="dnb-epreuve-item">
                      <label>📜 Histoire-Géo & EMC (sur 50 pts) :</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={tempEpreuves.histoireGeo}
                        onChange={e => handleEpreuveChange('histoireGeo', e.target.value)}
                      />
                    </div>

                    <div className="dnb-epreuve-item">
                      <label>🔬 Sciences (SVT/Physique/Tech) (sur 50 pts) :</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={tempEpreuves.sciences}
                        onChange={e => handleEpreuveChange('sciences', e.target.value)}
                      />
                    </div>

                    <div className="dnb-epreuve-item">
                      <label>🗣️ Épreuve Orale / Soutenance (sur 100 pts) :</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tempEpreuves.oral}
                        onChange={e => handleEpreuveChange('oral', e.target.value)}
                      />
                    </div>

                    <div className="dnb-epreuve-item dnb-epreuve-item--bonus">
                      <label>➕ Option / Latin (Bonus 0 à 20 pts) :</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={tempEpreuves.optionBonus}
                        onChange={e => handleEpreuveChange('optionBonus', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Commentaires & prédictions du conseil */}
                <div className="dnb-card__field">
                  <label>📝 Commentaires ou conseils du Professeur Principal pour le Brevet :</label>
                  <textarea
                    rows="2"
                    placeholder="Conseils de révision, points forts et axes de progrès pour les épreuves finales..."
                    value={tempCommentaires}
                    onChange={e => setTempCommentaires(e.target.value)}
                  />
                </div>

                {/* Actions */}
                <div className="dnb-card__actions">
                  <button
                    type="button"
                    className="dnb-card__save-btn"
                    disabled={saving}
                    onClick={handleSaveDnb}
                  >
                    {saving ? 'Sauvegarde...' : `💾 Enregistrer la Simulation DNB (${grandTotalDnb}/800 pts)`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Tableau Récapitulatif de la classe */}
          <div className="dnb-simulator__section">
            <h4 className="dnb-simulator__section-title">📊 Prédictions DNB pour la classe ({elevesClasse.length} élèves)</h4>
            <div className="dnb-table-wrapper">
              <table className="dnb-table">
                <thead>
                  <tr>
                    <th>Élève</th>
                    <th>Socle (/400)</th>
                    <th>Épreuves (/400)</th>
                    <th>Total (/800)</th>
                    <th>Mention Estimée</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {elevesClasse.map(e => {
                    const data = dnbMap[e._id];
                    const soclePts = computeSocleScore(data?.socle);
                    const dnbObj = data?.dnb;
                    const totalPts = dnbObj ? dnbObj.noteFinalCalculated : soclePts + 280;
                    const epreuvesPts = dnbObj ? totalPts - (dnbObj.ptsSocleCustom ?? soclePts) : 280;
                    const mInfo = getMentionInfo(totalPts);

                    return (
                      <tr key={e._id} className={String(e._id) === String(activeStudentId) ? 'dnb-table__tr--active' : ''}>
                        <td><strong>{e.nom} {e.prenoms?.[0]}.</strong></td>
                        <td>{dnbObj?.ptsSocleCustom ?? soclePts} / 400</td>
                        <td>{epreuvesPts} / 400</td>
                        <td style={{ fontWeight: 'bold', fontSize: '1rem' }}>{totalPts} / 800</td>
                        <td>
                          <span className="dnb-table__badge" style={{ background: mInfo.color }}>
                            {mInfo.label}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="dnb-table__edit-btn"
                            onClick={() => setActiveStudentId(e._id)}
                          >
                            ✏️ Simuler
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

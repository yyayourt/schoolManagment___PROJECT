"use client";

import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import { useUserRole } from '../../../stores/useUserRole';
import './Stage3emeManager.scss';

export const STATUTS_CONVENTION = [
  { id: 'EN_ATTENTE_RECHERCHE', label: 'En recherche d\'entreprise', shortLabel: 'Recherche', color: '#94a3b8', icon: '🔍' },
  { id: 'EN_ATTENTE_SIGNATURE', label: 'En attente de signature', shortLabel: 'En attente', color: '#f59e0b', icon: '⏳' },
  { id: 'SIGNEE_FAMILLE', label: 'Signée par la famille', shortLabel: 'Signée', color: '#2563eb', icon: '📝' },
  { id: 'VALIDE_PRINCIPAL', label: 'Validée par le Principal', shortLabel: 'Validée', color: '#10b981', icon: '✅' },
  { id: 'REFUSEE', label: 'Refusée / Non conforme', shortLabel: 'Refusée', color: '#ef4444', icon: '❌' }
];

export const APPRECIATIONS_TUTEUR = [
  { id: 'EXCELLENT', label: 'Excellent', color: '#8b5cf6', icon: '🌟' },
  { id: 'BON', label: 'Bon', color: '#10b981', icon: '👍' },
  { id: 'SATISFAISANT', label: 'Satisfaisant', color: '#2563eb', icon: '👌' },
  { id: 'INSUFFISANT', label: 'Insuffisant', color: '#ef4444', icon: '⚠️' },
  { id: 'NON_EVALUE', label: 'Non évalué', color: '#64748b', icon: '❓' }
];

export default function Stage3emeManager({ classIdProp = null, schoolYearProp = '2023-2024' }) {
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

  const [stageMap, setStageMap] = useState({});
  const [activeStudentId, setActiveStudentId] = useState(null);

  // Formulaire temporaire pour l'élève actif
  const [tempEntreprise, setTempEntreprise] = useState({ nom: '', secteur: '', adresse: '', tuteurNom: '', tuteurContact: '' });
  const [tempDates, setTempDates] = useState({ dateDebut: '', dateFin: '' });
  const [tempStatutConvention, setTempStatutConvention] = useState('EN_ATTENTE_RECHERCHE');
  const [tempSuiviVisite, setTempSuiviVisite] = useState({ enseignantReferentNom: '', visiteEffectuee: false, dateVisite: '', modalite: 'SUR_PLACE', appreciationTuteur: 'NON_EVALUE' });
  const [tempEvaluation, setTempEvaluation] = useState({ noteEntreprise: '', noteRapport: '', noteSoutenance: '', commentaireGlobal: '' });

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

  // Charger les données de stage de la classe
  const fetchStageData = useCallback(async () => {
    if (!selectedClassId) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await fetch(`/api/school_ai/stage?classeId=${selectedClassId}&annee=${selectedAnnee}`);
      
      let json = {};
      try {
        json = await res.json();
      } catch (parseErr) {
        throw new Error(`Erreur serveur (${res.status} ${res.statusText})`);
      }

      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur de chargement des stages');

      const map = {};
      if (Array.isArray(json.data)) {
        json.data.forEach(item => {
          map[item.eleveId] = item;
        });
      }
      setStageMap(map);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedAnnee]);

  useEffect(() => {
    fetchStageData();
  }, [fetchStageData]);

  // Pré-remplir le formulaire pour l'élève actif
  useEffect(() => {
    if (activeStudentId) {
      const existing = stageMap[activeStudentId];
      if (existing) {
        setTempEntreprise(existing.entreprise || { nom: '', secteur: '', adresse: '', tuteurNom: '', tuteurContact: '' });
        setTempDates({
          dateDebut: existing.dates?.dateDebut ? new Date(existing.dates.dateDebut).toISOString().substring(0, 10) : '',
          dateFin: existing.dates?.dateFin ? new Date(existing.dates.dateFin).toISOString().substring(0, 10) : ''
        });
        setTempStatutConvention(existing.statutConvention || 'EN_ATTENTE_RECHERCHE');
        setTempSuiviVisite({
          enseignantReferentNom: existing.suiviVisite?.enseignantReferentNom || '',
          visiteEffectuee: existing.suiviVisite?.visiteEffectuee || false,
          dateVisite: existing.suiviVisite?.dateVisite ? new Date(existing.suiviVisite.dateVisite).toISOString().substring(0, 10) : '',
          modalite: existing.suiviVisite?.modalite || 'SUR_PLACE',
          appreciationTuteur: existing.suiviVisite?.appreciationTuteur || 'NON_EVALUE'
        });
        setTempEvaluation({
          noteEntreprise: existing.evaluation?.noteEntreprise !== null && existing.evaluation?.noteEntreprise !== undefined ? String(existing.evaluation.noteEntreprise) : '',
          noteRapport: existing.evaluation?.noteRapport !== null && existing.evaluation?.noteRapport !== undefined ? String(existing.evaluation.noteRapport) : '',
          noteSoutenance: existing.evaluation?.noteSoutenance !== null && existing.evaluation?.noteSoutenance !== undefined ? String(existing.evaluation.noteSoutenance) : '',
          commentaireGlobal: existing.evaluation?.commentaireGlobal || ''
        });
      } else {
        setTempEntreprise({ nom: '', secteur: '', adresse: '', tuteurNom: '', tuteurContact: '' });
        setTempDates({ dateDebut: '', dateFin: '' });
        setTempStatutConvention('EN_ATTENTE_RECHERCHE');
        setTempSuiviVisite({ enseignantReferentNom: '', visiteEffectuee: false, dateVisite: '', modalite: 'SUR_PLACE', appreciationTuteur: 'NON_EVALUE' });
        setTempEvaluation({ noteEntreprise: '', noteRapport: '', noteSoutenance: '', commentaireGlobal: '' });
      }
    }
  }, [activeStudentId, stageMap]);

  // Sauvegarde des données de stage
  const handleSaveStage = async () => {
    if (!activeStudentId) return;
    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch('/api/school_ai/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eleveId: activeStudentId,
          annee: selectedAnnee,
          entreprise: tempEntreprise,
          dates: {
            dateDebut: tempDates.dateDebut ? new Date(tempDates.dateDebut) : null,
            dateFin: tempDates.dateFin ? new Date(tempDates.dateFin) : null
          },
          statutConvention: tempStatutConvention,
          suiviVisite: {
            ...tempSuiviVisite,
            dateVisite: tempSuiviVisite.dateVisite ? new Date(tempSuiviVisite.dateVisite) : null
          },
          evaluation: {
            noteEntreprise: tempEvaluation.noteEntreprise !== '' ? Number(tempEvaluation.noteEntreprise) : null,
            noteRapport: tempEvaluation.noteRapport !== '' ? Number(tempEvaluation.noteRapport) : null,
            noteSoutenance: tempEvaluation.noteSoutenance !== '' ? Number(tempEvaluation.noteSoutenance) : null,
            commentaireGlobal: tempEvaluation.commentaireGlobal
          }
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Erreur lors de la sauvegarde');

      setStageMap(prev => ({
        ...prev,
        [activeStudentId]: json.data
      }));

      const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));
      setMessage({ type: 'success', text: `✅ Dossier de stage de 3ème mis à jour pour ${activeStudent?.nom} ${activeStudent?.prenoms?.[0] || ''} !` });
      setTimeout(() => setMessage(null), 3500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const activeStudent = elevesClasse.find(e => String(e._id) === String(activeStudentId));

  // Calcul dynamique de la moyenne affichée dans le formulaire
  const currentNotes = [
    tempEvaluation.noteEntreprise !== '' ? Number(tempEvaluation.noteEntreprise) : null,
    tempEvaluation.noteRapport !== '' ? Number(tempEvaluation.noteRapport) : null,
    tempEvaluation.noteSoutenance !== '' ? Number(tempEvaluation.noteSoutenance) : null,
  ].filter(n => n !== null && !isNaN(n));

  const computedMoyenne = currentNotes.length > 0 ? (currentNotes.reduce((a, b) => a + b, 0) / currentNotes.length).toFixed(1) : null;

  return (
    <div className="stage-manager">
      {/* Toolbar */}
      <div className="stage-manager__toolbar">
        {!classIdProp && (
          <div className="stage-manager__field">
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

        <div className="stage-manager__field">
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
        <div className={`stage-manager__alert stage-manager__alert--${message.type}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="stage-manager__loading">Chargement des conventions & stages de 3ème...</div>
      ) : !selectedClassId ? (
        <div className="stage-manager__empty">Veuillez sélectionner une classe.</div>
      ) : (
        <div className="stage-manager__body">
          {/* Section 1: Grille des élèves */}
          <div className="stage-manager__section">
            <h4 className="stage-manager__section-title">
              💼 Stagiaires de la classe ({elevesClasse.length} élèves)
            </h4>
            <div className="stage-manager__icon-grid">
              {elevesClasse.map(eleve => {
                const isSelected = String(eleve._id) === String(activeStudentId);
                const data = stageMap[eleve._id];
                const convObj = STATUTS_CONVENTION.find(s => s.id === data?.statutConvention) || STATUTS_CONVENTION[0];
                const moy = data?.evaluation?.moyenneStage;

                return (
                  <button
                    key={eleve._id}
                    type="button"
                    className={`stage-icon-btn ${isSelected ? 'stage-icon-btn--selected' : ''}`}
                    onClick={() => setActiveStudentId(eleve._id)}
                  >
                    <div className="stage-icon-btn__avatar">
                      <img src={eleve.photo || '/school/classe.webp'} alt={eleve.nom} />
                      <span className="stage-icon-btn__badge">{convObj.icon}</span>
                    </div>
                    <span className="stage-icon-btn__name">{eleve.nom} {eleve.prenoms?.[0] || ''}.</span>
                    <span className="stage-icon-btn__company">
                      {data?.entreprise?.nom || 'Sans entreprise'}
                    </span>
                    {moy !== null && moy !== undefined && (
                      <span className="stage-icon-btn__grade">{moy} / 20</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Formulaire d'Édition du Stage */}
          {activeStudent && (
            <div className="stage-manager__section">
              <div className="stage-card">
                <div className="stage-card__header">
                  <div className="stage-card__identity">
                    <img src={activeStudent.photo || '/school/classe.webp'} alt="" className="stage-card__avatar" />
                    <div>
                      <h3>{activeStudent.nom} {activeStudent.prenoms?.join(' ')}</h3>
                      <div className="stage-card__subtitle">Dossier de Stage d'Observation de 3ème</div>
                    </div>
                  </div>

                  {/* Badge Moyenne Globale */}
                  <div className="stage-card__moyenne-box">
                    <div className="stage-card__moyenne-title">Moyenne du Stage</div>
                    <div className="stage-card__moyenne-val">
                      {computedMoyenne ? `${computedMoyenne} / 20` : 'Non noté'}
                    </div>
                  </div>
                </div>

                {/* Bloc 1: Entreprise d'accueil & Convention */}
                <div className="stage-card__block">
                  <h4>🏢 1. Entreprise d'Accueil & Convention de Stage</h4>
                  
                  <div className="stage-card__grid-fields">
                    <div className="stage-card__field">
                      <label>Nom de l'entreprise :</label>
                      <input
                        type="text"
                        placeholder="ex: Cabinet d'Architecture, Thales, Boulangerie..."
                        value={tempEntreprise.nom}
                        onChange={e => setTempEntreprise(prev => ({ ...prev, nom: e.target.value }))}
                      />
                    </div>

                    <div className="stage-card__field">
                      <label>Secteur d'activité :</label>
                      <input
                        type="text"
                        placeholder="ex: Informatique, BTP, Santé, Artisanal..."
                        value={tempEntreprise.secteur}
                        onChange={e => setTempEntreprise(prev => ({ ...prev, secteur: e.target.value }))}
                      />
                    </div>

                    <div className="stage-card__field">
                      <label>Tuteur en entreprise :</label>
                      <input
                        type="text"
                        placeholder="Nom & prénom du maître de stage..."
                        value={tempEntreprise.tuteurNom}
                        onChange={e => setTempEntreprise(prev => ({ ...prev, tuteurNom: e.target.value }))}
                      />
                    </div>

                    <div className="stage-card__field">
                      <label>Contact Tuteur (Tél / Email) :</label>
                      <input
                        type="text"
                        placeholder="ex: 06 12 34 56 78 / tuteur@entreprise.com"
                        value={tempEntreprise.tuteurContact}
                        onChange={e => setTempEntreprise(prev => ({ ...prev, tuteurContact: e.target.value }))}
                      />
                    </div>

                    <div className="stage-card__field" style={{ gridColumn: 'span 2' }}>
                      <label>Adresse du lieu de stage :</label>
                      <input
                        type="text"
                        placeholder="Adresse complète du site..."
                        value={tempEntreprise.adresse}
                        onChange={e => setTempEntreprise(prev => ({ ...prev, adresse: e.target.value }))}
                      />
                    </div>

                    <div className="stage-card__field">
                      <label>Date de début :</label>
                      <input
                        type="date"
                        value={tempDates.dateDebut}
                        onChange={e => setTempDates(prev => ({ ...prev, dateDebut: e.target.value }))}
                      />
                    </div>

                    <div className="stage-card__field">
                      <label>Date de fin :</label>
                      <input
                        type="date"
                        value={tempDates.dateFin}
                        onChange={e => setTempDates(prev => ({ ...prev, dateFin: e.target.value }))}
                      />
                    </div>

                    <div className="stage-card__field" style={{ gridColumn: 'span 2' }}>
                      <label>Statut de la Convention de Stage :</label>
                      <select
                        value={tempStatutConvention}
                        onChange={e => setTempStatutConvention(e.target.value)}
                      >
                        {STATUTS_CONVENTION.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.icon} {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bloc 2: Suivi & Visite de l'Enseignant Référent */}
                <div className="stage-card__block">
                  <h4>🏫 2. Suivi & Visite de l'Enseignant Référent</h4>
                  {isFamily ? (
                    <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                      <p><b>Professeur référent attitré :</b> {tempSuiviVisite.enseignantReferentNom || <i>En cours d'attribution</i>}</p>
                      <p style={{ marginTop: '0.3rem' }}><b>Visite ou échange :</b> {tempSuiviVisite.visiteEffectuee ? `✅ Effectué le ${tempSuiviVisite.dateVisite || ''} (${tempSuiviVisite.modalite})` : '⏳ Pas encore effectué'}</p>
                      {(() => {
                        const appObj = APPRECIATIONS_TUTEUR.find(a => a.id === tempSuiviVisite.appreciationTuteur);
                        return appObj && appObj.id !== 'NON_EVALUE' ? (
                          <p style={{ marginTop: '0.3rem' }}><b>Appréciation du tuteur :</b> {appObj.icon} {appObj.label}</p>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <div className="stage-card__grid-fields">
                      <div className="stage-card__field">
                        <label>Professeur Référent / Suiveur :</label>
                        <input
                          type="text"
                          placeholder="Nom du professeur en charge du suivi..."
                          value={tempSuiviVisite.enseignantReferentNom}
                          onChange={e => setTempSuiviVisite(prev => ({ ...prev, enseignantReferentNom: e.target.value }))}
                        />
                      </div>

                      <div className="stage-card__field" style={{ justifyContent: 'center' }}>
                        <label className="stage-checkbox-label">
                          <input
                            type="checkbox"
                            checked={tempSuiviVisite.visiteEffectuee}
                            onChange={e => setTempSuiviVisite(prev => ({ ...prev, visiteEffectuee: e.target.checked }))}
                          />
                          <span>Visite ou échange effectué</span>
                        </label>
                      </div>

                      {tempSuiviVisite.visiteEffectuee && (
                        <>
                          <div className="stage-card__field">
                            <label>Date de la visite / échange :</label>
                            <input
                              type="date"
                              value={tempSuiviVisite.dateVisite}
                              onChange={e => setTempSuiviVisite(prev => ({ ...prev, dateVisite: e.target.value }))}
                            />
                          </div>

                          <div className="stage-card__field">
                            <label>Modalité du suivi :</label>
                            <select
                              value={tempSuiviVisite.modalite}
                              onChange={e => setTempSuiviVisite(prev => ({ ...prev, modalite: e.target.value }))}
                            >
                              <option value="SUR_PLACE">🚗 Sur place (en entreprise)</option>
                              <option value="TELEPHONIQUE">📞 Échange Téléphonique</option>
                              <option value="VISIO">💻 Visioconférence</option>
                            </select>
                          </div>
                        </>
                      )}

                      <div className="stage-card__field" style={{ gridColumn: 'span 2' }}>
                        <label>Appréciation générale du Tuteur d'Entreprise :</label>
                        <div className="stage-card__pills">
                          {APPRECIATIONS_TUTEUR.map(app => {
                            const isSelected = tempSuiviVisite.appreciationTuteur === app.id;
                            return (
                              <button
                                key={app.id}
                                type="button"
                                className={`stage-pill ${isSelected ? 'stage-pill--active' : ''}`}
                                style={{ '--pill-color': app.color }}
                                onClick={() => setTempSuiviVisite(prev => ({ ...prev, appreciationTuteur: app.id }))}
                              >
                                <span>{app.icon}</span>
                                <span>{app.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloc 3: Notation du Stage sur 20 */}
                <div className="stage-card__block stage-card__block--evaluation">
                  <h4>📊 3. Évaluation & Notes du Stage (sur 20 points)</h4>
                  {isFamily ? (
                    <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                      {computedMoyenne ? (
                        <div>
                          <p><b>Note Tuteur :</b> {tempEvaluation.noteEntreprise ? `${tempEvaluation.noteEntreprise} / 20` : 'En attente'}</p>
                          <p><b>Note Rapport :</b> {tempEvaluation.noteRapport ? `${tempEvaluation.noteRapport} / 20` : 'En attente'}</p>
                          <p><b>Note Soutenance :</b> {tempEvaluation.noteSoutenance ? `${tempEvaluation.noteSoutenance} / 20` : 'En attente'}</p>
                          <p style={{ marginTop: '0.4rem', fontSize: '0.95rem', fontWeight: 800, color: '#2563eb' }}>
                            Moyenne Générale de Stage : {computedMoyenne} / 20
                          </p>
                          {tempEvaluation.commentaireGlobal && (
                            <p style={{ marginTop: '0.4rem' }}><b>Appréciation du jury :</b> {tempEvaluation.commentaireGlobal}</p>
                          )}
                        </div>
                      ) : (
                        <p>⏳ <i>L'évaluation du stage et les notes ne sont pas encore publiées par l'établissement.</i></p>
                      )}
                    </div>
                  ) : (
                    <div className="stage-card__grid-fields">
                      <div className="stage-card__field">
                        <label>Note Tuteur / Entreprise (/20) :</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          placeholder="ex: 18"
                          value={tempEvaluation.noteEntreprise}
                          onChange={e => setTempEvaluation(prev => ({ ...prev, noteEntreprise: e.target.value }))}
                        />
                      </div>

                      <div className="stage-card__field">
                        <label>Note du Rapport Écrit (/20) :</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          placeholder="ex: 15.5"
                          value={tempEvaluation.noteRapport}
                          onChange={e => setTempEvaluation(prev => ({ ...prev, noteRapport: e.target.value }))}
                        />
                      </div>

                      <div className="stage-card__field">
                        <label>Note de la Soutenance Orale (/20) :</label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          placeholder="ex: 16"
                          value={tempEvaluation.noteSoutenance}
                          onChange={e => setTempEvaluation(prev => ({ ...prev, noteSoutenance: e.target.value }))}
                        />
                      </div>

                      <div className="stage-card__field" style={{ gridColumn: 'span 3', marginTop: '0.5rem' }}>
                        <label>Commentaires ou appréciations du jury :</label>
                        <textarea
                          rows="2"
                          placeholder="Remarques du professeur et du jury sur la qualité de l'immersion et de la prestation orale..."
                          value={tempEvaluation.commentaireGlobal}
                          onChange={e => setTempEvaluation(prev => ({ ...prev, commentaireGlobal: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action de sauvegarde */}
                <div className="stage-card__actions">
                  <button
                    type="button"
                    className="stage-card__save-btn"
                    disabled={saving}
                    onClick={handleSaveStage}
                  >
                    {saving ? 'Enregistrement...' : isFamily ? `💾 Soumettre / Mettre à jour la Convention de ${activeStudent.nom}` : `💾 Enregistrer le Dossier de Stage de ${activeStudent.nom}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Tableau récapitulatif de la classe (masqué pour les familles) */}
          {!isFamily && (
            <div className="stage-manager__section">
              <h4 className="stage-manager__section-title">📊 Bilan des Stages de 3ème de la Classe ({elevesClasse.length} élèves)</h4>
              <div className="stage-table-wrapper">
                <table className="stage-table">
                  <thead>
                    <tr>
                      <th>Élève</th>
                      <th>Entreprise d'Accueil</th>
                      <th>Convention</th>
                      <th>Visite Professeur</th>
                      <th>Moyenne Stage (/20)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevesClasse.map(e => {
                      const data = stageMap[e._id];
                      const convObj = STATUTS_CONVENTION.find(s => s.id === data?.statutConvention) || STATUTS_CONVENTION[0];
                      const moy = data?.evaluation?.moyenneStage;

                      return (
                        <tr key={e._id} className={String(e._id) === String(activeStudentId) ? 'stage-table__tr--active' : ''}>
                          <td><strong>{e.nom} {e.prenoms?.[0]}.</strong></td>
                          <td>
                            {data?.entreprise?.nom ? (
                              <span>🏢 {data.entreprise.nom} {data.entreprise.secteur ? `(${data.entreprise.secteur})` : ''}</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>En recherche...</span>
                            )}
                          </td>
                          <td>
                            <span className="stage-table__badge" style={{ background: convObj.color }}>
                              {convObj.icon} {convObj.shortLabel}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {data?.suiviVisite?.visiteEffectuee ? '✅ Fait' : '⏳ En attente'}
                          </td>
                          <td style={{ fontWeight: 'bold', textAlign: 'center' }}>
                            {moy !== null && moy !== undefined ? `${moy} / 20` : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="stage-table__edit-btn"
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

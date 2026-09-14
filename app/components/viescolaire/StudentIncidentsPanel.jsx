"use client";

import { useState, useEffect, useCallback } from 'react';
import './StudentIncidentsPanel.scss';

export default function StudentIncidentsPanel({ studentId, userRole = 'admin' }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Formulaire d'incident (Profs / Admins / CPE)
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [gravite, setGravite] = useState('FAIBLE');
  const [sanctionType, setSanctionType] = useState('AUCUNE');
  const [sanctionDetails, setSanctionDetails] = useState('');
  const [travailAFaire, setTravailAFaire] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Édition de la sanction par le CPE
  const [editingSanctionId, setEditingSanctionId] = useState(null);
  const [editType, setEditType] = useState('HEURE_DE_COLLE');
  const [editDetails, setEditDetails] = useState('');
  const [editTravail, setEditTravail] = useState('');

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/school_ai/incidents?eleveId=${studentId}`);
      if (!res.ok) throw new Error('Erreur lors du chargement des incidents');
      const data = await res.json();
      setIncidents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) fetchIncidents();
  }, [studentId, fetchIncidents]);

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/school_ai/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eleveId: studentId,
          rapporteurId: studentId, // fallback ID
          description,
          gravite,
          sanction: {
            type: sanctionType,
            details: sanctionDetails,
            travailAFaire,
            estSigneParParent: false
          }
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la création de l incident');

      setDescription('');
      setSanctionDetails('');
      setTravailAFaire('');
      setShowForm(false);
      fetchIncidents();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCpeSanction = async (incidentId) => {
    try {
      const res = await fetch('/api/school_ai/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: incidentId,
          sanction: {
            type: editType,
            details: editDetails,
            travailAFaire: editTravail,
            estSigneParParent: false
          }
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la définition de la sanction');
      setEditingSanctionId(null);
      fetchIncidents();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSignSanction = async (incident) => {
    try {
      const res = await fetch('/api/school_ai/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: incident._id,
          sanction: {
            ...incident.sanction,
            estSigneParParent: true,
            dateSignature: new Date()
          }
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la signature de la sanction');
      fetchIncidents();
    } catch (err) {
      alert(err.message);
    }
  };

  const getGraviteBadge = (g) => {
    switch (g) {
      case 'GRAVE': return <span className="incident-badge incident-badge--grave">🔴 Gravité Élevée</span>;
      case 'MOYENNE': return <span className="incident-badge incident-badge--moyenne">🟠 Gravité Moyenne</span>;
      default: return <span className="incident-badge incident-badge--faible">🟡 Gravité Faible</span>;
    }
  };

  return (
    <div className="student-incidents-panel">
      <div className="student-incidents-panel__header">
        <h3 className="student-incidents-panel__title">
          <span>🚨</span> Discipline, Incidents & Sanctions
        </h3>
        {['admin', 'prof', 'cpe'].includes(userRole) && (
          <button
            type="button"
            className="student-incidents-panel__add-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '✕ Annuler' : '+ Signaler un incident'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreateIncident} className="incident-form">
          <div className="incident-form__row">
            <div className="incident-form__group">
              <label>Gravité de l'incident</label>
              <select value={gravite} onChange={(e) => setGravite(e.target.value)}>
                <option value="FAIBLE">🟡 Faible (Avertissement oral)</option>
                <option value="MOYENNE">🟠 Moyenne (Bavardage répété, indiscipline)</option>
                <option value="GRAVE">🔴 Grave (Manque de respect, altercation)</option>
              </select>
            </div>

            <div className="incident-form__group">
              <label>Sanction préconisée ou décidée</label>
              <select value={sanctionType} onChange={(e) => setSanctionType(e.target.value)}>
                <option value="AUCUNE">Transmettre au CPE sans sanction immédiate</option>
                <option value="HEURE_DE_COLLE">⏱️ Heure de colle / Retenue</option>
                <option value="AVERTISSEMENT">⚠️ Avertissement écrit</option>
                <option value="EXCLUSION_COURS">🚫 Exclusion ponctuelle de cours</option>
                <option value="EXCLUSION_ETABLISSEMENT">❌ Exclusion temporaire d'établissement</option>
              </select>
            </div>
          </div>

          <div className="incident-form__group">
            <label>Description des faits</label>
            <textarea
              rows="3"
              placeholder="Décrire précisément l'incident survenu..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {sanctionType !== 'AUCUNE' && (
            <div className="incident-form__row">
              <div className="incident-form__group">
                <label>Détails / Horaires de la sanction</label>
                <input
                  type="text"
                  placeholder="Ex: Mercredi 14h-15h en salle de permanence"
                  value={sanctionDetails}
                  onChange={(e) => setSanctionDetails(e.target.value)}
                />
              </div>

              <div className="incident-form__group">
                <label>Travail à réaliser en colle</label>
                <input
                  type="text"
                  placeholder="Ex: Copier le chapitre 3 et faire les ex 4 à 8"
                  value={travailAFaire}
                  onChange={(e) => setTravailAFaire(e.target.value)}
                />
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting} className="incident-form__submit">
            {submitting ? 'Enregistrement...' : '🚨 Transmettre l incident'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="student-incidents-panel__empty">Chargement du suivi disciplinaire...</div>
      ) : error ? (
        <div className="student-incidents-panel__error">{error}</div>
      ) : incidents.length === 0 ? (
        <div className="student-incidents-panel__empty">
          ✨ Aucun incident ni sanction répertorié pour cet élève.
        </div>
      ) : (
        <div className="incidents-list">
          {incidents.map((item) => (
            <div key={item._id} className="incident-card">
              <div className="incident-card__header">
                <div className="incident-card__meta">
                  {getGraviteBadge(item.gravite)}
                  <span className="incident-card__date">
                    📅 {new Date(item.dateIncident).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {item.sanction && item.sanction.type !== 'AUCUNE' ? (
                  <span className="incident-card__sanction-tag">
                    Sanction: {item.sanction.type.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="incident-card__sanction-tag incident-card__sanction-tag--pending">
                    ⏳ Transmis au CPE
                  </span>
                )}
              </div>

              <p className="incident-card__description">{item.description}</p>

              {/* Box sanction existante ou décision CPE */}
              {editingSanctionId === item._id ? (
                <div className="incident-card__cpe-edit-box">
                  <h5>⚖️ Décision du CPE sur la sanction :</h5>
                  <div className="incident-form__row">
                    <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                      <option value="HEURE_DE_COLLE">⏱️ Heure de colle</option>
                      <option value="AVERTISSEMENT">⚠️ Avertissement écrit</option>
                      <option value="EXCLUSION_COURS">🚫 Exclusion de cours</option>
                      <option value="EXCLUSION_ETABLISSEMENT">❌ Exclusion établissement</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Créneau / Horaires"
                      value={editDetails}
                      onChange={(e) => setEditDetails(e.target.value)}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Travail à effectuer"
                    value={editTravail}
                    onChange={(e) => setEditTravail(e.target.value)}
                  />
                  <div className="incident-card__cpe-actions">
                    <button type="button" className="incident-card__cancel-btn" onClick={() => setEditingSanctionId(null)}>Annuler</button>
                    <button type="button" className="incident-card__save-btn" onClick={() => handleSaveCpeSanction(item._id)}>Enregistrer la sanction</button>
                  </div>
                </div>
              ) : item.sanction && item.sanction.type !== 'AUCUNE' ? (
                <div className="incident-card__sanction-box">
                  <div className="incident-card__sanction-title">
                    ⚖️ Détails de la sanction :
                  </div>
                  {item.sanction.details && (
                    <div><strong>Créneau :</strong> {item.sanction.details}</div>
                  )}
                  {item.sanction.travailAFaire && (
                    <div><strong>Travail à faire :</strong> {item.sanction.travailAFaire}</div>
                  )}
                </div>
              ) : (
                ['admin', 'cpe'].includes(userRole) && (
                  <button
                    type="button"
                    className="incident-card__decide-btn"
                    onClick={() => {
                      setEditingSanctionId(item._id);
                      setEditType('HEURE_DE_COLLE');
                      setEditDetails('');
                      setEditTravail('');
                    }}
                  >
                    ⚖️ Prononcer une sanction (CPE)
                  </button>
                )
              )}

              <div className="incident-card__footer">
                {item.sanction?.estSigneParParent ? (
                  <span className="incident-card__signed">
                    ✅ Sanction signée par les responsables
                  </span>
                ) : (
                  ['parent', 'admin'].includes(userRole) && item.sanction?.type !== 'AUCUNE' && (
                    <button
                      type="button"
                      className="incident-card__sign-btn"
                      onClick={() => handleSignSanction(item)}
                    >
                      ✍️ Signer et prendre acte de la sanction
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

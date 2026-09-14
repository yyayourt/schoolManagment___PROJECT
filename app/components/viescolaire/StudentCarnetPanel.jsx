"use client";

import { useState, useEffect, useCallback } from 'react';
import './StudentCarnetPanel.scss';

export default function StudentCarnetPanel({ studentId, userRole = 'admin' }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Formulaire d'ajout (Profs / Admins / CPE)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState('OBSERVATION');
  const [newTitre, setNewTitre] = useState('');
  const [newContenu, setNewContenu] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // État pour la réponse textuelle du parent lors de la signature
  const [activeSigningId, setActiveSigningId] = useState(null);
  const [reponseParentText, setReponseParentText] = useState('');

  // Charger les mots du carnet
  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/school_ai/carnet?eleveId=${studentId}`);
      if (!res.ok) throw new Error('Erreur lors du chargement du carnet');
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) fetchEntries();
  }, [studentId, fetchEntries]);

  // Ajouter un billet de carnet
  const handleCreateEntry = async (e) => {
    e.preventDefault();
    if (!newTitre.trim() || !newContenu.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/school_ai/carnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eleveId: studentId,
          auteurId: studentId, // fallback ID
          auteurRole: userRole === 'parent' ? 'PARENT' : 'PROF',
          type: newType,
          titre: newTitre,
          contenu: newContenu
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la création du billet');
      
      setNewTitre('');
      setNewContenu('');
      setShowAddForm(false);
      fetchEntries();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Signer / marquer comme lu avec réponse parentale optionnelle
  const handleSignEntry = async (entryId) => {
    try {
      const res = await fetch('/api/school_ai/carnet', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entryId,
          luParParent: true,
          signatureParent: true,
          reponseParent: reponseParentText.trim()
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la signature');
      setActiveSigningId(null);
      setReponseParentText('');
      fetchEntries();
    } catch (err) {
      alert(err.message);
    }
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'CONVOCATION': return 'carnet-badge--danger';
      case 'AUTORISATION': return 'carnet-badge--warning';
      case 'INFORMATION': return 'carnet-badge--info';
      default: return 'carnet-badge--primary';
    }
  };

  return (
    <div className="student-carnet-panel">
      <div className="student-carnet-panel__header">
        <h3 className="student-carnet-panel__title">
          <span>📘</span> Carnet de Correspondance Numérique
        </h3>
        {['admin', 'prof', 'cpe'].includes(userRole) && (
          <button
            type="button"
            className="student-carnet-panel__add-btn"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? '✕ Annuler' : '+ Nouveau mot de carnet'}
          </button>
        )}
      </div>

      {/* Formulaire de création */}
      {showAddForm && (
        <form onSubmit={handleCreateEntry} className="student-carnet-form">
          <div className="student-carnet-form__group">
            <label>Type de billet</label>
            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="OBSERVATION">📝 Observation</option>
              <option value="INFORMATION">ℹ️ Information</option>
              <option value="CONVOCATION">⚠️ Convocation</option>
              <option value="AUTORISATION">📄 Demande d'autorisation</option>
            </select>
          </div>

          <div className="student-carnet-form__group">
            <label>Titre / Objet</label>
            <input
              type="text"
              placeholder="Ex: Matériel manquant en SVT"
              value={newTitre}
              onChange={(e) => setNewTitre(e.target.value)}
              required
            />
          </div>

          <div className="student-carnet-form__group">
            <label>Message à destination des responsables</label>
            <textarea
              rows="3"
              placeholder="Rédiger le billet de carnet..."
              value={newContenu}
              onChange={(e) => setNewContenu(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="student-carnet-form__submit">
            {submitting ? 'Envoi...' : '📩 Envoyer le mot dans le carnet'}
          </button>
        </form>
      )}

      {/* Liste des mots */}
      {loading ? (
        <div className="student-carnet-panel__empty">Chargement du carnet...</div>
      ) : error ? (
        <div className="student-carnet-panel__error">{error}</div>
      ) : entries.length === 0 ? (
        <div className="student-carnet-panel__empty">
          Aucun mot ou billet enregistré dans le carnet pour le moment.
        </div>
      ) : (
        <div className="student-carnet-list">
          {entries.map((entry) => (
            <div key={entry._id} className="student-carnet-card">
              <div className="student-carnet-card__header">
                <div className="student-carnet-card__meta">
                  <span className={`carnet-badge ${getTypeBadgeClass(entry.type)}`}>
                    {entry.type}
                  </span>
                  <span className="student-carnet-card__date">
                    📅 {new Date(entry.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="student-carnet-card__status">
                  {entry.signatureParent ? (
                    <span className="carnet-status carnet-status--signed">
                      ✅ Signé par les parents
                    </span>
                  ) : (
                    <span className="carnet-status carnet-status--pending">
                      ⏳ En attente de signature
                    </span>
                  )}
                </div>
              </div>

              <h4 className="student-carnet-card__title">{entry.titre}</h4>
              <p className="student-carnet-card__content">{entry.contenu}</p>

              {/* Réponse parentale enregistrée */}
              {entry.reponseParent && (
                <div className="student-carnet-card__parent-reply">
                  💬 <strong>Réponse des responsables :</strong> <em>"{entry.reponseParent}"</em>
                </div>
              )}

              {/* Formulaire ou action de signature */}
              <div className="student-carnet-card__footer">
                {!entry.signatureParent && ['parent', 'admin'].includes(userRole) && (
                  activeSigningId === entry._id ? (
                    <div className="student-carnet-card__signing-box">
                      <textarea
                        rows="2"
                        placeholder="Remarque ou réponse optionnelle pour l'établissement..."
                        value={reponseParentText}
                        onChange={(e) => setReponseParentText(e.target.value)}
                      />
                      <div className="student-carnet-card__signing-actions">
                        <button
                          type="button"
                          className="student-carnet-card__cancel-btn"
                          onClick={() => setActiveSigningId(null)}
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          className="student-carnet-card__sign-btn"
                          onClick={() => handleSignEntry(entry._id)}
                        >
                          ✍️ Valider la signature
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="student-carnet-card__sign-btn"
                      onClick={() => setActiveSigningId(entry._id)}
                    >
                      ✍️ Signer et répondre
                    </button>
                  )
                )}
                {entry.signatureParent && entry.dateSignature && (
                  <div className="student-carnet-card__signed-info">
                    ✍️ Signé électroniquement le {new Date(entry.dateSignature).toLocaleDateString('fr-FR')} à {new Date(entry.dateSignature).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

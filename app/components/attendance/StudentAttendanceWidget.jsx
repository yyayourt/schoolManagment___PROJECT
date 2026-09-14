'use client';
import { useState, useEffect, useCallback } from 'react';
import { fetchStudentAttendance, STATUS_META } from './attendanceApi';
import './StudentAttendanceWidget.scss';

function formatDay(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return '';
  }
}

export default function StudentAttendanceWidget({ studentId, userRole = 'admin' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // État du formulaire d'envoi de justificatif
  const [activeEntryForJustify, setActiveEntryForJustify] = useState(null);
  const [justificationNote, setJustificationNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    fetchStudentAttendance(studentId)
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [studentId, loadData]);

  // Soumettre un justificatif (Parent)
  const handleSubmitJustification = async (e) => {
    e.preventDefault();
    if (!activeEntryForJustify || !justificationNote.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/attendance/${activeEntryForJustify._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificationNote })
      });

      if (!res.ok) throw new Error('Erreur lors de la soumission du justificatif');
      
      setActiveEntryForJustify(null);
      setJustificationNote('');
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Valider / Refuser un justificatif (CPE / Admin)
  const handleCpeAction = async (entryId, action) => {
    try {
      const res = await fetch(`/api/attendance/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificationAction: action })
      });

      if (!res.ok) throw new Error('Erreur lors de la validation par la Vie Scolaire');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <p className="attendanceWidget__loading">Chargement du bilan d assiduité…</p>;
  if (error) return <p className="attendanceWidget__error">{error}</p>;
  if (!data || data.total === 0) {
    return <p className="attendanceWidget__empty">Aucun enregistrement d assiduité pour le moment.</p>;
  }

  const { summary, recent } = data;

  return (
    <div className="attendanceWidget">
      <div className="attendanceWidget__counters">
        {['ABSENT', 'LATE', 'EXCUSED'].map((s) => (
          <div key={s} className={`attendanceWidget__counter attendanceWidget__counter--${STATUS_META[s].mod}`}>
            <span className="attendanceWidget__icon">{STATUS_META[s].icon}</span>
            <span className="attendanceWidget__num">{summary[s]}</span>
            <span className="attendanceWidget__label">{STATUS_META[s].short}</span>
          </div>
        ))}
      </div>

      {recent && recent.length > 0 && (
        <ul className="attendanceWidget__list">
          {recent.map((r) => {
            const isUnexcused = r.status === 'ABSENT' || r.status === 'LATE';
            const just = r.justification || {};

            return (
              <li key={r._id} className="attendanceWidget__row">
                <div className="attendanceWidget__row-header">
                  <span className={`attendanceWidget__tag attendanceWidget__tag--${STATUS_META[r.status].mod}`}>
                    {STATUS_META[r.status].icon} {STATUS_META[r.status].label}
                  </span>
                  <span className="attendanceWidget__date">{formatDay(r.date)}</span>
                </div>

                {r.comment && <div className="attendanceWidget__comment">💬 {r.comment}</div>}

                {/* Status du justificatif */}
                <div className="attendanceWidget__just-box">
                  {just.status === 'PENDING' && (
                    <div className="attendanceWidget__just-pending">
                      ⏳ Justificatif soumis : <em>"{just.note}"</em>
                      {['admin', 'cpe', 'prof'].includes(userRole) && (
                        <div className="attendanceWidget__cpe-actions">
                          <button
                            type="button"
                            className="attendanceWidget__btn-accept"
                            onClick={() => handleCpeAction(r._id, 'ACCEPT')}
                          >
                            ✅ Valider (Absence justifiée)
                          </button>
                          <button
                            type="button"
                            className="attendanceWidget__btn-reject"
                            onClick={() => handleCpeAction(r._id, 'REJECT')}
                          >
                            ❌ Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {just.status === 'ACCEPTED' && (
                    <div className="attendanceWidget__just-accepted">
                      ✅ Absence justifiée par la Vie Scolaire ({just.note})
                    </div>
                  )}

                  {just.status === 'REJECTED' && (
                    <div className="attendanceWidget__just-rejected">
                      🔴 Justificatif refusé par la Vie Scolaire
                    </div>
                  )}

                  {isUnexcused && (!just.status || just.status === 'NONE') && (
                    <div className="attendanceWidget__just-none">
                      <span className="attendanceWidget__unexcused-badge">🔴 Non justifiée</span>
                      {['parent', 'admin'].includes(userRole) && (
                        <button
                          type="button"
                          className="attendanceWidget__justify-btn"
                          onClick={() => setActiveEntryForJustify(r)}
                        >
                          ✍️ Transmettre un justificatif
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal / Formulaire de saisie du justificatif */}
      {activeEntryForJustify && (
        <div className="attendance-modal-overlay">
          <form onSubmit={handleSubmitJustification} className="attendance-modal">
            <h4>✍️ Justificatif d absence du {formatDay(activeEntryForJustify.date)}</h4>
            <label>Veuillez indiquer le motif médical ou personnel :</label>
            <textarea
              rows="3"
              placeholder="Ex: Rendez-vous médical chez le médecin traitant, certificat fourni."
              value={justificationNote}
              onChange={(e) => setJustificationNote(e.target.value)}
              required
            />
            <div className="attendance-modal__actions">
              <button
                type="button"
                className="attendance-modal__cancel"
                onClick={() => setActiveEntryForJustify(null)}
              >
                Annuler
              </button>
              <button type="submit" disabled={submitting} className="attendance-modal__submit">
                {submitting ? 'Envoi...' : 'Envoyer au CPE'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

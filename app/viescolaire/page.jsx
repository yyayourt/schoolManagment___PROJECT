"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUserRole } from '../../stores/useUserRole';
import { fetchUserWithRefs, studentFullName } from '../components/family/familyApi';
import StudentAttendanceWidget from '../components/attendance/StudentAttendanceWidget';
import StudentCarnetPanel from '../components/viescolaire/StudentCarnetPanel';
import StudentIncidentsPanel from '../components/viescolaire/StudentIncidentsPanel';
import './VieScolaireDashboard.scss';

export default function VieScolaireDashboardPage() {
  const { userRole, clerkUser, userData } = useUserRole();
  const [data, setData] = useState(null);
  const [familyData, setFamilyData] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('absences');

  useEffect(() => {
    let alive = true;
    if (userRole === 'parent' || userRole === 'eleve') {
      (async () => {
        try {
          setLoading(true);
          const u = await fetchUserWithRefs(clerkUser?.id || 'sandbox_user');
          if (!alive) return;
          setFamilyData(u);
          const children = u?.roleData?.childrenRefs || [];
          const eleve = u?.roleData?.eleveRef || null;

          if (userRole === 'parent' && children.length > 0) {
            setSelectedStudentId(children[0]._id);
          } else if (userRole === 'eleve' && eleve?._id) {
            setSelectedStudentId(eleve._id);
          }
        } catch (err) {
          if (alive) setError(err.message);
        } finally {
          if (alive) setLoading(false);
        }
      })();
    } else {
      fetchDashboard();
    }
    return () => { alive = false; };
  }, [userRole, clerkUser, userData]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/school_ai/viescolaire/dashboard');
      if (!res.ok) throw new Error('Erreur lors du chargement du tableau de bord Vie Scolaire');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateJustification = async (entryId, action) => {
    try {
      const res = await fetch(`/api/attendance/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificationAction: action })
      });

      if (!res.ok) throw new Error('Erreur lors de la validation');
      fetchDashboard();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="viescolaire-dashboard__loading">Chargement du tableau de bord Vie Scolaire...</div>;
  if (error) return <div className="viescolaire-dashboard__error">{error}</div>;

  // Vue dédiée pour Parent et Élève
  if (userRole === 'parent' || userRole === 'eleve') {
    const children = familyData?.roleData?.childrenRefs || [];
    const activeStudentId = selectedStudentId || (children[0]?._id);

    return (
      <div className="viescolaire-dashboard" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        <header className="viescolaire-dashboard__header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 className="viescolaire-dashboard__title">🏛️ Espace Vie Scolaire {userRole === 'parent' ? 'Famille' : 'Élève'}</h1>
            <p className="viescolaire-dashboard__subtitle">
              Justificatifs d'absence, mots de carnet et suivi disciplinaire.
            </p>
          </div>
        </header>

        {userRole === 'parent' && children.length > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {children.map((child) => (
              <button
                key={child._id}
                type="button"
                onClick={() => setSelectedStudentId(child._id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: String(activeStudentId) === String(child._id) ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: String(activeStudentId) === String(child._id) ? '#eff6ff' : 'white',
                  color: String(activeStudentId) === String(child._id) ? '#1e40af' : '#475569',
                  fontWeight: String(activeStudentId) === String(child._id) ? '700' : '500',
                  cursor: 'pointer',
                }}
              >
                🧒 {studentFullName(child)}
              </button>
            ))}
          </div>
        )}

        {!activeStudentId ? (
          <div className="viescolaire-empty">Aucun élève rattaché à ce compte.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* 1. Assiduité & Soumission de justificatif */}
            <section style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
                ⏱️ Assiduité & Transmettre un Justificatif
              </h2>
              <StudentAttendanceWidget studentId={activeStudentId} userRole={userRole} />
            </section>

            {/* 2. Carnet de correspondance numérique & Signatures */}
            <section style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <StudentCarnetPanel studentId={activeStudentId} userRole={userRole} />
            </section>

            {/* 3. Incidents & Sanctions */}
            <section style={{ background: 'white', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <StudentIncidentsPanel studentId={activeStudentId} userRole={userRole} />
            </section>
          </div>
        )}
      </div>
    );
  }

  const { stats, recentIncidents, pendingCarnets, pendingAttendance } = data || {};

  return (
    <div className="viescolaire-dashboard">
      <header className="viescolaire-dashboard__header">
        <div>
          <h1 className="viescolaire-dashboard__title">🏛️ Tableau de Bord Vie Scolaire (CPE)</h1>
          <p className="viescolaire-dashboard__subtitle">
            Pilotage de l'assiduité, de la discipline et des correspondances pour l'établissement.
          </p>
        </div>
        <button type="button" onClick={fetchDashboard} className="viescolaire-dashboard__refresh-btn">
          🔄 Actualiser
        </button>
      </header>

      {/* Cartes de métriques KPIs */}
      <div className="viescolaire-kpis">
        <div className="viescolaire-kpi-card viescolaire-kpi-card--danger">
          <div className="viescolaire-kpi-card__icon">🔴</div>
          <div className="viescolaire-kpi-card__data">
            <span className="viescolaire-kpi-card__val">{stats?.unexcusedAbsencesCount || 0}</span>
            <span className="viescolaire-kpi-card__label">Absences non justifiées</span>
          </div>
        </div>

        <div className="viescolaire-kpi-card viescolaire-kpi-card--warning">
          <div className="viescolaire-kpi-card__icon">⏳</div>
          <div className="viescolaire-kpi-card__data">
            <span className="viescolaire-kpi-card__val">{stats?.pendingJustificationsCount || 0}</span>
            <span className="viescolaire-kpi-card__label">Justificatifs à valider par le CPE</span>
          </div>
        </div>

        <div className="viescolaire-kpi-card viescolaire-kpi-card--incident">
          <div className="viescolaire-kpi-card__icon">🚨</div>
          <div className="viescolaire-kpi-card__data">
            <span className="viescolaire-kpi-card__val">{stats?.totalIncidents || 0}</span>
            <span className="viescolaire-kpi-card__label">Incidents signalés au total</span>
          </div>
        </div>

        <div className="viescolaire-kpi-card viescolaire-kpi-card--info">
          <div className="viescolaire-kpi-card__icon">📘</div>
          <div className="viescolaire-kpi-card__data">
            <span className="viescolaire-kpi-card__val">{stats?.pendingCarnetSignaturesCount || 0}</span>
            <span className="viescolaire-kpi-card__label">Mots de carnet non signés</span>
          </div>
        </div>
      </div>

      {/* Navigation par Onglets */}
      <div className="viescolaire-tabs">
        <button
          className={`viescolaire-tab-btn ${activeTab === 'absences' ? '--active' : ''}`}
          onClick={() => setActiveTab('absences')}
        >
          ⏱️ Assiduité & Justificatifs ({pendingAttendance?.length || 0})
        </button>
        <button
          className={`viescolaire-tab-btn ${activeTab === 'incidents' ? '--active' : ''}`}
          onClick={() => setActiveTab('incidents')}
        >
          🚨 Registre Disciplinaire ({recentIncidents?.length || 0})
        </button>
        <button
          className={`viescolaire-tab-btn ${activeTab === 'carnet' ? '--active' : ''}`}
          onClick={() => setActiveTab('carnet')}
        >
          📘 Carnet de Correspondance ({pendingCarnets?.length || 0})
        </button>
      </div>

      {/* Onglet 1 : Assiduité & Justificatifs */}
      {activeTab === 'absences' && (
        <div className="viescolaire-pane">
          <h3 className="viescolaire-pane__title">Derniers signalements d'Absences & Retards</h3>
          {!pendingAttendance || pendingAttendance.length === 0 ? (
            <div className="viescolaire-empty">Aucune absence enregistrée.</div>
          ) : (
            <div className="viescolaire-table-wrapper">
              <table className="viescolaire-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Élève</th>
                    <th>Statut</th>
                    <th>Commentaire / Justificatif</th>
                    <th>Action CPE</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingAttendance.map((item) => {
                    const student = item.studentId || {};
                    const just = item.justification || {};
                    return (
                      <tr key={item._id}>
                        <td>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : 'N/A'}</td>
                        <td>
                          <Link href={`/eleves/${student._id}`} className="viescolaire-student-link">
                            <strong>{student.nom} {Array.isArray(student.prenoms) ? student.prenoms.join(' ') : student.prenoms}</strong>
                          </Link>
                        </td>
                        <td>
                          <span className={`viescolaire-tag viescolaire-tag--${item.status.toLowerCase()}`}>
                            {item.status === 'ABSENT' ? '🔴 Absent' : '🟠 En retard'}
                          </span>
                        </td>
                        <td>
                          {just.note ? (
                            <div className="viescolaire-just-note">
                              💬 <em>"{just.note}"</em>
                            </div>
                          ) : (
                            <span className="viescolaire-muted">Sans justificatif</span>
                          )}
                        </td>
                        <td>
                          {just.status === 'PENDING' ? (
                            <div className="viescolaire-actions-row">
                              <button
                                type="button"
                                className="viescolaire-btn-accept"
                                onClick={() => handleValidateJustification(item._id, 'ACCEPT')}
                              >
                                ✅ Valider
                              </button>
                              <button
                                type="button"
                                className="viescolaire-btn-reject"
                                onClick={() => handleValidateJustification(item._id, 'REJECT')}
                              >
                                ❌ Refuser
                              </button>
                            </div>
                          ) : just.status === 'ACCEPTED' ? (
                            <span className="viescolaire-text-success">✅ Justifiée</span>
                          ) : just.status === 'REJECTED' ? (
                            <span className="viescolaire-text-danger">🔴 Refusée</span>
                          ) : (
                            <span className="viescolaire-text-muted">En attente parent</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Onglet 2 : Incidents */}
      {activeTab === 'incidents' && (
        <div className="viescolaire-pane">
          <h3 className="viescolaire-pane__title">Rapports d'Incidents & Sanctions Récentes</h3>
          {!recentIncidents || recentIncidents.length === 0 ? (
            <div className="viescolaire-empty">Aucun incident répertorié.</div>
          ) : (
            <div className="viescolaire-grid">
              {recentIncidents.map((inc) => {
                const student = inc.eleveId || {};
                const reporter = inc.rapporteurId || {};
                return (
                  <div key={inc._id} className="viescolaire-card viescolaire-card--incident">
                    <div className="viescolaire-card__header">
                      <span className={`viescolaire-gravite viescolaire-gravite--${inc.gravite.toLowerCase()}`}>
                        Gravité: {inc.gravite}
                      </span>
                      <span className="viescolaire-card__date">
                        {new Date(inc.dateIncident).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    <h4 className="viescolaire-card__student">
                      Élève : <Link href={`/eleves/${student._id}`}>{student.nom} {Array.isArray(student.prenoms) ? student.prenoms.join(' ') : student.prenoms}</Link>
                    </h4>
                    <p className="viescolaire-card__desc">{inc.description}</p>

                    {inc.sanction && inc.sanction.type !== 'AUCUNE' && (
                      <div className="viescolaire-card__sanction">
                        <strong>Sanction :</strong> {inc.sanction.type.replace('_', ' ')}
                        {inc.sanction.details && <div><em>Créneau : {inc.sanction.details}</em></div>}
                      </div>
                    )}

                    <div className="viescolaire-card__footer">
                      <span className="viescolaire-card__reporter">Signalé par : {reporter.nom || 'Professeur'}</span>
                      {inc.sanction?.estSigneParParent ? (
                        <span className="viescolaire-badge-signed">✅ Signé parent</span>
                      ) : (
                        <span className="viescolaire-badge-pending">⏳ Non signé</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Onglet 3 : Mots de Carnet */}
      {activeTab === 'carnet' && (
        <div className="viescolaire-pane">
          <h3 className="viescolaire-pane__title">Mots de Carnet de Correspondance en Attente de Signature</h3>
          {!pendingCarnets || pendingCarnets.length === 0 ? (
            <div className="viescolaire-empty">Tous les mots du carnet sont signés ! 🎉</div>
          ) : (
            <div className="viescolaire-grid">
              {pendingCarnets.map((carnet) => {
                const student = carnet.eleveId || {};
                return (
                  <div key={carnet._id} className="viescolaire-card viescolaire-card--carnet">
                    <div className="viescolaire-card__header">
                      <span className="viescolaire-carnet-type">{carnet.type}</span>
                      <span className="viescolaire-card__date">
                        {new Date(carnet.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    <h4 className="viescolaire-card__student">
                      Élève : <Link href={`/eleves/${student._id}`}>{student.nom} {Array.isArray(student.prenoms) ? student.prenoms.join(' ') : student.prenoms}</Link>
                    </h4>
                    <h5 className="viescolaire-card__title">{carnet.titre}</h5>
                    <p className="viescolaire-card__desc">{carnet.contenu}</p>

                    <div className="viescolaire-card__footer">
                      <span className="viescolaire-badge-pending">⏳ Signature parentale requise</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

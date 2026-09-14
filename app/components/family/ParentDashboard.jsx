'use client';
import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import { useUserRole } from '../../../stores/useUserRole';
import { fetchUserWithRefs, studentFullName } from './familyApi';
import AppointmentsPanel from '../appointments/AppointmentsPanel';
import HomeworkTodoList from '../homework/HomeworkTodoList';
import StudentPointsWidget from '../points/StudentPointsWidget';

// Nom lisible d'une classe à partir de son _id (via le contexte admin).
function classLabel(classes, classId) {
  if (!classId || !Array.isArray(classes)) return '';
  const c = classes.find((x) => String(x._id || x.id) === String(classId));
  return c ? `${c.niveau || ''} ${c.alias || ''}`.trim() : '';
}

export default function ParentDashboard() {
  const { classes } = useContext(AiAdminContext);
  const { clerkUser, userData } = useUserRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await fetchUserWithRefs(clerkUser?.id || 'sandbox_user');
        if (alive && u) {
          setData(u);
          setLoading(false);
          if (u?.roleData?.childrenRefs?.length > 0) {
            setSelectedChildId(u.roleData.childrenRefs[0]._id);
          }
          return;
        }
      } catch (_) { /* fallback below */ }
      if (alive) { 
        setData(userData); 
        setLoading(false);
        if (userData?.roleData?.childrenRefs?.length > 0) {
          setSelectedChildId(userData.roleData.childrenRefs[0]._id);
        }
      }
    })();
    return () => { alive = false; };
  }, [clerkUser, userData]);

  const children = data?.roleData?.childrenRefs || [];
  const firstName = data?.firstName || userData?.firstName || '';

  const activeChild = children.find(c => String(c._id) === String(selectedChildId)) || children[0] || null;
  const activeClassId = activeChild ? (activeChild.current_classe?._id || activeChild.current_classe) : null;

  return (
    <div className="familyHome familyHome--parent">
      <header className="familyHome__hero" style={{ background: 'linear-gradient(135deg, #1e293b, #3b82f6)', color: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <h1 className="familyHome__title" style={{ color: 'white', margin: 0 }}>👪 Bonjour {firstName || 'cher parent'}</h1>
        <p className="familyHome__subtitle" style={{ color: '#93c5fd', marginTop: '0.4rem' }}>Portail Famille — Suivi scolaire et administratif de vos enfants.</p>
      </header>

      <section className="familyHome__section" style={{ marginBottom: '2rem' }}>
        <h2 className="familyHome__sectionTitle" style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem' }}>🧒 Mes enfants ({children.length})</h2>
        {loading ? (
          <p className="familyHome__hint">Chargement…</p>
        ) : children.length === 0 ? (
          <p className="familyHome__hint">
            Aucun enfant rattaché à votre compte pour le moment. Contactez l'établissement pour la synchronisation.
          </p>
        ) : (
          <div>
            {/* Sélecteur de fratrie si plusieurs enfants */}
            {children.length > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {children.map((child) => (
                  <button
                    key={child._id}
                    type="button"
                    onClick={() => setSelectedChildId(child._id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: String(activeChild?._id) === String(child._id) ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: String(activeChild?._id) === String(child._id) ? '#eff6ff' : 'white',
                      color: String(activeChild?._id) === String(child._id) ? '#1e40af' : '#475569',
                      fontWeight: String(activeChild?._id) === String(child._id) ? '700' : '500',
                      cursor: 'pointer',
                    }}
                  >
                    🧒 {studentFullName(child)}
                  </button>
                ))}
              </div>
            )}

            {/* Fiche résumé de l'enfant actif */}
            {activeChild && (
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                      {studentFullName(activeChild)}
                    </h3>
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                      {classLabel(classes, activeChild.current_classe) || 'Classe du Collège'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href={`/eleves/${activeChild._id}`} style={{ padding: '6px 12px', background: '#2563eb', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                      📋 Voir le dossier complet
                    </Link>
                    <Link href="/groups" style={{ padding: '6px 12px', background: '#f1f5f9', color: '#334155', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                      💬 Contacter le prof
                    </Link>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                  {/* Cahier de texte */}
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b' }}>📚 Cahier de texte & Devoirs</h4>
                    <HomeworkTodoList studentId={activeChild._id} classId={activeClassId} interactive={false} />
                  </div>

                  {/* Bons points & comportement */}
                  <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b' }}>⭐ Comportement & Bons points</h4>
                    <StudentPointsWidget studentId={activeChild._id} canManage={false} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="familyHome__section" style={{ marginBottom: '2rem' }}>
        <h2 className="familyHome__sectionTitle" style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem' }}>📅 Mes rendez-vous</h2>
        <AppointmentsPanel initiatorRole="parent" canCreate={false} />
      </section>

      <section className="familyHome__section">
        <h2 className="familyHome__sectionTitle" style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem' }}>🚀 Accès Rapides Collège</h2>
        <div className="familyHome__quickLinks" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <Link href="/orientation" className="familyHome__quick" style={{ padding: '1rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🧭 Orientation Post-3ème</Link>
          <Link href="/stages-3eme" className="familyHome__quick" style={{ padding: '1rem', background: '#ccfbf1', color: '#115e59', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>💼 Stages de 3ème & Conventions</Link>
          <Link href="/brevet-dnb" className="familyHome__quick" style={{ padding: '1rem', background: '#dbeafe', color: '#1e40af', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🎓 Simulateur Brevet (DNB)</Link>
          <Link href="/socle-commun" className="familyHome__quick" style={{ padding: '1rem', background: '#fef3c7', color: '#92400e', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🎯 Socle Commun & Compétences</Link>
          <Link href="/dispositifs-inclusifs" className="familyHome__quick" style={{ padding: '1rem', background: '#cff4fc', color: '#055160', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🤝 Dispositifs (PAP/PAI)</Link>
          <Link href="/viescolaire" className="familyHome__quick" style={{ padding: '1rem', background: '#fecdd3', color: '#9f1239', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🏛️ Vie Scolaire & Mots de Carnet</Link>
        </div>
      </section>
    </div>
  );
}

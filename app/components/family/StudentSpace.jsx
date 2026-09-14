'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUserRole } from '../../../stores/useUserRole';
import { fetchUserWithRefs, studentFullName } from './familyApi';
import HomeworkTodoList from '../homework/HomeworkTodoList';
import StudentPointsWidget from '../points/StudentPointsWidget';

export default function StudentSpace() {
  const { clerkUser, userData } = useUserRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await fetchUserWithRefs(clerkUser?.id || 'sandbox_user');
        if (alive && u) { setData(u); setLoading(false); return; }
      } catch (_) { /* fallback below */ }
      if (alive) { setData(userData); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [clerkUser, userData]);

  const eleve = data?.roleData?.eleveRef || null;
  const firstName = data?.firstName || userData?.firstName || '';
  const profileHref = eleve?._id ? `/eleves/${eleve._id}` : null;
  const classId = eleve?.current_classe?._id || eleve?.current_classe || null;

  return (
    <div className="familyHome familyHome--student">
      <header className="familyHome__hero" style={{ background: 'linear-gradient(135deg, #4f46e5, #06b6d4)', color: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
        <h1 className="familyHome__title" style={{ color: 'white', margin: 0 }}>🎒 Salut {firstName || (eleve ? studentFullName(eleve) : 'à toi')} !</h1>
        <p className="familyHome__subtitle" style={{ color: '#c7d2fe', marginTop: '0.4rem' }}>Ton espace personnel — devoirs, points et parcours collège.</p>
      </header>

      {loading ? (
        <p className="familyHome__hint">Chargement…</p>
      ) : !profileHref ? (
        <p className="familyHome__hint">
          Ton profil élève n'est pas encore rattaché à ce compte. Contacte ton établissement si besoin.
        </p>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {/* Cahier de texte interactif */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>📚 Mon Cahier de Texte</h3>
                <Link href={profileHref} style={{ fontSize: '0.85rem', color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>
                  Voir tout ➔
                </Link>
              </div>
              <HomeworkTodoList studentId={eleve._id} classId={classId} interactive={true} />
            </div>

            {/* Mes Bons Points avec Confetti sur nouveaux points */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>⭐ Mes Bons Points & Badges</h3>
              <StudentPointsWidget studentId={eleve._id} celebrateOnNew={true} canManage={false} />
            </div>
          </div>

          <section className="familyHome__section">
            <h2 className="familyHome__sectionTitle" style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '1rem' }}>🚀 Raccourcis Collège</h2>
            <div className="familyHome__quickLinks" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <Link href={profileHref} className="familyHome__quick" style={{ padding: '1rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>📋 Mon Dossier & Notes</Link>
              <Link href="/orientation" className="familyHome__quick" style={{ padding: '1rem', background: '#cff4fc', color: '#055160', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🧭 Mes Vœux d'Orientation</Link>
              <Link href="/stages-3eme" className="familyHome__quick" style={{ padding: '1rem', background: '#ccfbf1', color: '#115e59', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>💼 Mon Stage de 3ème</Link>
              <Link href="/brevet-dnb" className="familyHome__quick" style={{ padding: '1rem', background: '#dbeafe', color: '#1e40af', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🎓 Simulateur Brevet DNB</Link>
              <Link href="/socle-commun" className="familyHome__quick" style={{ padding: '1rem', background: '#fef3c7', color: '#92400e', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🎯 Mon Socle Commun</Link>
              <Link href="/games" className="familyHome__quick" style={{ padding: '1rem', background: '#f3e8ff', color: '#6b21a8', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>🎮 Jeux Pédagogiques</Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

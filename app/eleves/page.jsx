"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUserRole } from '../../stores/useUserRole';
import { fetchUserWithRefs, studentFullName } from '../components/family/familyApi';

export default function ElevesPage() {
  const router = useRouter();
  const { userRole, clerkUser, userData } = useUserRole();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await fetchUserWithRefs(clerkUser?.id || 'sandbox_user');
        if (alive && u) {
          setData(u);
          setLoading(false);
          
          // Si c'est un élève, rediriger directement vers son dossier
          if (userRole === 'eleve' && u?.roleData?.eleveRef?._id) {
            router.replace(`/eleves/${u.roleData.eleveRef._id}`);
            return;
          }
          // Si c'est un parent avec un seul enfant, rediriger directement vers son dossier
          if (userRole === 'parent' && u?.roleData?.childrenRefs?.length === 1) {
            router.replace(`/eleves/${u.roleData.childrenRefs[0]._id}`);
            return;
          }
          return;
        }
      } catch (_) { /* fallback below */ }
      if (alive) {
        setData(userData);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clerkUser, userData, userRole, router]);

  const children = data?.roleData?.childrenRefs || [];
  const eleve = data?.roleData?.eleveRef || null;

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
        <h2>⏳ Chargement du suivi des élèves…</h2>
      </div>
    );
  }

  // VUE PARENT
  if (userRole === 'parent') {
    return (
      <div style={{ maxWidth: '1000px', margin: '2rem auto', padding: '0 1rem' }}>
        <header style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', padding: '2rem', borderRadius: '12px', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>👨‍👩‍👧‍👦 Suivi de mes Enfants</h1>
          <p style={{ color: '#93c5fd', marginTop: '0.5rem', marginBottom: 0 }}>
            Sélectionnez un enfant pour consulter ses notes, ses devoirs, son assiduité et son dossier scolaire.
          </p>
        </header>

        {children.length === 0 ? (
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
              Aucun enfant n'est actuellement rattaché à votre compte parent.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              Contactez l'administration de l'établissement pour faire lier le dossier de votre enfant à votre adresse email.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {children.map((child) => {
              const name = studentFullName(child);
              const classLabel = child.current_classe ? (child.current_classe.alias || child.current_classe.niveau || 'Classe attribuée') : 'Non inscrit';
              return (
                <div
                  key={child._id}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', border: '2px solid #3b82f6' }}>
                        🧒
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>{name}</h2>
                        <span style={{ display: 'inline-block', marginTop: '0.2rem', padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                          🏫 {classLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
                    <Link
                      href={`/eleves/${child._id}`}
                      style={{
                        padding: '10px 16px',
                        background: '#2563eb',
                        color: 'white',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontWeight: 600,
                        textDecoration: 'none'
                      }}
                    >
                      📋 Consulter le Dossier Complet ➔
                    </Link>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <Link
                        href={`/viescolaire`}
                        style={{
                          padding: '8px 12px',
                          background: '#f1f5f9',
                          color: '#334155',
                          borderRadius: '6px',
                          textAlign: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          textDecoration: 'none'
                        }}
                      >
                        🏛️ Vie Scolaire
                      </Link>
                      <Link
                        href={`/eleves/${child._id}?tab=scolarite`}
                        style={{
                          padding: '8px 12px',
                          background: '#f1f5f9',
                          color: '#334155',
                          borderRadius: '6px',
                          textAlign: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          textDecoration: 'none'
                        }}
                      >
                        💶 Scolarité
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // VUE ÉLÈVE
  if (userRole === 'eleve') {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto', padding: '2rem', background: 'white', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
        <h1>🎒 Mon Dossier Élève</h1>
        {eleve?._id ? (
          <Link href={`/eleves/${eleve._id}`} style={{ display: 'inline-block', marginTop: '1rem', padding: '12px 24px', background: '#4f46e5', color: 'white', borderRadius: '8px', fontWeight: 600, textDecoration: 'none' }}>
            Accéder à mon dossier ➔
          </Link>
        ) : (
          <p style={{ color: '#64748b' }}>Votre profil élève n'est pas rattaché à ce compte.</p>
        )}
      </div>
    );
  }

  // VUE ADMIN / PROF: Redirection vers les classes
  return (
    <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '2rem', background: 'white', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
      <h1>👥 Répertoire des Élèves</h1>
      <p style={{ color: '#64748b' }}>Pour consulter les dossiers élèves par classe, rendez-vous dans la section Gestion des Classes.</p>
      <Link href="/classes" style={{ display: 'inline-block', marginTop: '1rem', padding: '12px 24px', background: '#2563eb', color: 'white', borderRadius: '8px', fontWeight: 600, textDecoration: 'none' }}>
        🏫 Accéder aux Classes ➔
      </Link>
    </div>
  );
}

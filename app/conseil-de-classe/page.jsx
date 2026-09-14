"use client";

import Link from 'next/link';
import PermissionGate from '../components/PermissionGate';
import ConseilClasseManager from '../components/pedagogie/ConseilClasseManager';

export default function DedicatedConseilClassePage() {
  return (
    <PermissionGate
      roles={['admin', 'prof']}
      fallback={
        <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
          <h1 style={{ color: '#ef4444', fontSize: '1.5rem' }}>Accès refusé</h1>
          <p style={{ color: '#64748b' }}>
            Les délibérations du conseil de classe sont réservées au corps enseignant et à l'administration.
          </p>
          <Link href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>Retour à l'accueil</Link>
        </div>
      }
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <Link href="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
            ⬅️ Retour au tableau de bord
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 0 0' }}>
            🏛️ Tenue & Synthèse des Conseils de Classe
          </h1>
          <p style={{ color: '#64748b', margin: '0.4rem 0 0 0', fontSize: '0.95rem' }}>
            Outil de saisie des mentions officielles, appréciations du Professeur Principal et avis d'orientation.
          </p>
        </header>

        <ConseilClasseManager />
      </div>
    </PermissionGate>
  );
}

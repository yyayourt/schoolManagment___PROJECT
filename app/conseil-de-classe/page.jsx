"use client";

import ConseilClasseManager from '../components/pedagogie/ConseilClasseManager';

export default function DedicatedConseilClassePage() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          🏛️ Tenue & Synthèse des Conseils de Classe
        </h1>
        <p style={{ color: '#64748b', margin: '0.4rem 0 0 0', fontSize: '0.95rem' }}>
          Outil de saisie des mentions officielles, appréciations du Professeur Principal et avis d'orientation.
        </p>
      </header>

      <ConseilClasseManager />
    </div>
  );
}

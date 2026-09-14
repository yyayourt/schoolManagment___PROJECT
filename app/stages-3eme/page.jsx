"use client";

import Link from 'next/link';
import PermissionGate from '../components/PermissionGate';
import Stage3emeManager from '../components/pedagogie/Stage3emeManager';

export default function Stages3emePage() {
  return (
    <PermissionGate roles={['admin', 'prof', 'parent', 'eleve']}>
      <div style={{ padding: '2rem', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link href="/" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
              ⬅️ Retour au tableau de bord
            </Link>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 0.25rem 0' }}>
              💼 Gestion des Stages d'Observation de 3ème
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>
              Suivi des conventions d'entreprise, visites des professeurs référents et notation des rapports & soutenances de stage
            </p>
          </div>
        </div>

        <Stage3emeManager />
      </div>
    </PermissionGate>
  );
}

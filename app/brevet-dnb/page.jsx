"use client";

import Link from 'next/link';
import PermissionGate from '../components/PermissionGate';
import DnbSimulator from '../components/pedagogie/DnbSimulator';

export default function DnbPage() {
  return (
    <PermissionGate roles={['admin', 'prof', 'parent', 'eleve']}>
      <div style={{ padding: '2rem', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link href="/" style={{ color: '#8b5cf6', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
              ⬅️ Retour au tableau de bord
            </Link>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 0.25rem 0' }}>
              🎓 Simulateur Officiel du Brevet (DNB — 800 points)
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>
              Simulation en temps réel des points du Socle Commun (400 pts) et des Épreuves Finales (400 pts) avec prédiction des mentions
            </p>
          </div>
        </div>

        <DnbSimulator />
      </div>
    </PermissionGate>
  );
}

"use client";

import Link from 'next/link';
import PermissionGate from '../components/PermissionGate';
import InclusiveDeviceManager from '../components/pedagogie/InclusiveDeviceManager';

export default function InclusiveDevicesPage() {
  return (
    <PermissionGate roles={['admin', 'prof', 'parent', 'eleve']}>
      <div style={{ padding: '2rem', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link href="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
              ⬅️ Retour au tableau de bord
            </Link>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 0.25rem 0' }}>
              🎯 Dispositifs Inclusifs & Accompagnements Particuliers
            </h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>
              Gestion et suivi des PAP (Plan d'Accompagnement Personnalisé), PPRE (Réussite Éducative), PAI (Projet d'Accueil Individualisé - Santé) et PPS (MDPH / AESH)
            </p>
          </div>
        </div>

        <InclusiveDeviceManager />
      </div>
    </PermissionGate>
  );
}

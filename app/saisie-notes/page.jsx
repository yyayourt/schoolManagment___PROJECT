"use client"

import React from 'react';
import SaisieNotesCollege from '../components/SaisieNotesCollege';
import { useUserRole } from '../../stores/useUserRole';
import Link from 'next/link';

export default function DedicatedNotesPage() {
    const { hasAnyRole } = useUserRole();
    const canEdit = hasAnyRole(['admin', 'prof']);

    if (!canEdit) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', marginTop: '50px' }}>
                <h1 style={{ color: '#ef4444' }}>Accès Refusé</h1>
                <p>Cette page est strictement réservée au corps enseignant.</p>
                <Link href="/" style={{ color: '#2563eb', textDecoration: 'underline' }}>Retour à l'accueil</Link>
            </div>
        );
    }

    return (
        <div style={{ 
            maxWidth: '1200px', 
            margin: '40px auto', 
            padding: '40px 20px',
            fontFamily: 'Outfit, sans-serif',
            background: '#f8fafc',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e0e7ff', width: '80px', height: '80px', borderRadius: '50%', marginBottom: '20px' }}>
                    <i className="fas fa-edit" style={{ fontSize: '30px', color: '#4338ca' }}></i>
                </div>
                <h1 style={{ fontSize: '2.5rem', color: '#1e293b', margin: '0 0 10px 0', fontWeight: '800' }}>Centre d'Évaluations</h1>
                <p style={{ color: '#64748b', fontSize: '1.2rem', margin: 0, maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Créez vos devoirs (DS, CC, Examens) et saisissez facilement les notes de vos classes. Le calcul des moyennes tiendra compte de vos paramètres !
                </p>
            </div>
            
            <SaisieNotesCollege />
        </div>
    );
}

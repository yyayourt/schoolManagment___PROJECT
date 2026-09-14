"use client";

import { useState, useEffect } from 'react';
import { TYPES_DISPOSITIFS } from './InclusiveDeviceManager';

export default function StudentInclusiveWidget({ studentId, schoolYear = '2023-2024' }) {
  const [deviceData, setDeviceData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    let isMounted = true;

    async function fetchStudentDevices() {
      try {
        setLoading(true);
        const res = await fetch(`/api/school_ai/inclusive_devices?eleveId=${studentId}&annee=${schoolYear}`);
        const json = await res.json();
        if (isMounted && json.success) {
          setDeviceData(json.data);
        }
      } catch (err) {
        console.error('Erreur chargement dispositifs élève:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStudentDevices();
    return () => { isMounted = false; };
  }, [studentId, schoolYear]);

  if (loading || !deviceData || !Array.isArray(deviceData.devices)) return null;

  const activeDevices = deviceData.devices.filter(d => d.statut !== 'ARCHIVE');
  if (activeDevices.length === 0) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)',
      border: '1px solid #93c5fd',
      borderLeft: '5px solid #2563eb',
      borderRadius: '12px',
      padding: '1rem 1.2rem',
      marginBottom: '1.5rem',
      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🤝</span>
          <strong style={{ fontSize: '1rem', color: '#1e3a8a', fontWeight: 800 }}>
            Dispositif Inclusif & Aménagements Spécifiques
          </strong>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {activeDevices.map(d => {
            const typeObj = TYPES_DISPOSITIFS.find(t => t.id === d.type);
            return (
              <span key={d.type} style={{
                background: typeObj?.color || '#2563eb',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {typeObj?.icon} {d.type}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {activeDevices.map((device, idx) => {
          const typeObj = TYPES_DISPOSITIFS.find(t => t.id === device.type);
          return (
            <div key={idx} style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '0.75rem',
              border: '1px solid rgba(191, 219, 254, 0.8)'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>
                {typeObj?.icon} {typeObj?.label} {device.diagnostiqueOuMotif ? `— ${device.diagnostiqueOuMotif}` : ''}
              </div>

              {device.referentOuAesh && (
                <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.4rem' }}>
                  <b>Référent / AESH :</b> {device.referentOuAesh}
                </div>
              )}

              {Array.isArray(device.amenagementsPedagogiques) && device.amenagementsPedagogiques.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    Aménagements en classe :
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#1e293b' }}>
                    {device.amenagementsPedagogiques.map((am, aIdx) => (
                      <li key={aIdx} style={{ marginBottom: '0.15rem' }}>{am}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

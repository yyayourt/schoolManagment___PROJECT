"use client";

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AiAdminContext } from '../../stores/ai_adminContext';

const DAYS = [
  { id: 1, label: 'Lundi' },
  { id: 2, label: 'Mardi' },
  { id: 3, label: 'Mercredi' },
  { id: 4, label: 'Jeudi' },
  { id: 5, label: 'Vendredi' }
];

const TIME_SLOTS = [
  '08:00 - 09:00',
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 13:00',
  '13:00 - 14:00',
  '14:00 - 15:00',
  '15:00 - 16:00',
  '16:00 - 17:00'
];

export default function RoomScheduleViewer() {
  const ctx = useContext(AiAdminContext);
  const classes = ctx?.classes || [];

  const [salles, setSalles] = useState([]);
  const [selectedSalleId, setSelectedSalleId] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [subjectsMap, setSubjectsMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Charger les salles et les matières
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Salles
        const resSalles = await fetch('/api/salles');
        const dataSalles = await resSalles.json();
        if (dataSalles.success) {
          setSalles(dataSalles.data || []);
          if (dataSalles.data?.length > 0) {
            setSelectedSalleId(dataSalles.data[0]._id);
          }
        }

        // Matières
        const resSubjects = await fetch('/api/school_ai/subjects');
        if (resSubjects.ok) {
          const subs = await resSubjects.json();
          const map = {};
          subs.forEach(s => { map[s._id] = s; });
          setSubjectsMap(map);
        }

        // Emplois du temps actifs de toutes les classes
        const resSched = await fetch('/api/schedules?includeArchived=false');
        const dataSched = await resSched.json();
        if (dataSched.success) {
          setSchedules(dataSched.data || []);
        }
      } catch (err) {
        console.error('Erreur chargement salles/EDT:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const currentSalle = salles.find(s => String(s._id) === String(selectedSalleId));

  // Trouver quelle classe / cours occupe la salle sur un créneau jour/heure
  const getSlotOccupation = (dayOfWeek, slotString) => {
    const [slotStart, slotEnd] = slotString.split(' - ');
    const occupations = [];

    // 1. Chercher dans les évènements d'emplois du temps explicitement affectés à cette salle
    schedules.forEach(sched => {
      const cls = classes.find(c => String(c._id) === String(sched.classeId));
      const clsName = cls ? `${cls.niveau} ${cls.alias}` : 'Classe';

      if (Array.isArray(sched.events)) {
        sched.events.forEach(evt => {
          if (evt.dayOfWeek === dayOfWeek) {
            const matchesSalleId = evt.salleId && String(evt.salleId) === String(selectedSalleId);
            const matchesSalleName = currentSalle && evt.salleNom && evt.salleNom.toLowerCase().includes(currentSalle.nom.toLowerCase());

            if (matchesSalleId || matchesSalleName) {
              const subj = evt.subjectId ? subjectsMap[evt.subjectId] : null;
              occupations.push({
                type: 'EVENT',
                classeName: clsName,
                subjectName: subj?.nom || evt.label || 'Cours',
                time: `${evt.startTime} - ${evt.endTime}`
              });
            }
          }
        });
      }
    });

    // 2. Si aucune affectation explicite d'événement, vérifier l'affectation de salle principale dans le corps enseignant de la classe
    if (occupations.length === 0 && currentSalle) {
      classes.forEach(cls => {
        if (Array.isArray(cls.corpsEnseignant)) {
          cls.corpsEnseignant.forEach(ce => {
            if (ce.sallePrincipale && ce.sallePrincipale.toLowerCase().includes(currentSalle.nom.toLowerCase())) {
              // Vérifier si cette classe a cours à cet horaire
              const sched = schedules.find(s => String(s.classeId) === String(cls._id));
              if (sched && Array.isArray(sched.events)) {
                sched.events.forEach(evt => {
                  if (evt.dayOfWeek === dayOfWeek && String(evt.subjectId) === String(ce.matiereId)) {
                    const subj = subjectsMap[ce.matiereId];
                    occupations.push({
                      type: 'CORPS_ENSEIGNANT',
                      classeName: `${cls.niveau} ${cls.alias}`,
                      subjectName: subj?.nom || 'Cours',
                      time: `${evt.startTime} - ${evt.endTime}`
                    });
                  }
                });
              }
            }
          });
        }
      });
    }

    return occupations;
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        ⏳ Chargement de l'occupation des salles...
      </div>
    );
  }

  return (
    <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
      {/* Barre de sélection de la salle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🏛️</span>
          <label style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>Sélectionner une salle :</label>
          <select
            value={selectedSalleId}
            onChange={e => setSelectedSalleId(e.target.value)}
            style={{ padding: '0.5rem 0.8rem', borderRadius: '6px', border: '1px solid #94a3b8', fontWeight: 600, fontSize: '0.9rem', background: '#ffffff' }}
          >
            {salles.map(s => (
              <option key={s._id} value={s._id}>
                {s.nom} ({s.type || 'CLASSIQUE'} — Capacité: {s.capacite || 30} él.)
              </option>
            ))}
          </select>
        </div>

        {currentSalle && (
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', color: '#475569' }}>
            <span style={{ background: '#e2e8f0', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
              📍 Étage {currentSalle.etage ?? 0}
            </span>
            {currentSalle.equipements?.map((eq, idx) => (
              <span key={idx} style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
                ⚡ {eq}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Grille de l'Emploi du Temps par Salle */}
      {!currentSalle ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>Aucune salle sélectionnée.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                <th style={{ padding: '0.75rem', border: '1px solid #334155', width: '130px' }}>Horaire</th>
                {DAYS.map(day => (
                  <th key={day.id} style={{ padding: '0.75rem', border: '1px solid #334155' }}>
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot, sIdx) => (
                <tr key={sIdx} style={{ background: sIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 700, fontSize: '0.825rem', color: '#334155', border: '1px solid #e2e8f0' }}>
                    {slot}
                  </td>

                  {DAYS.map(day => {
                    const occs = getSlotOccupation(day.id, slot);
                    const isBusy = occs.length > 0;
                    const hasConflict = occs.length > 1;

                    return (
                      <td
                        key={day.id}
                        style={{
                          padding: '0.5rem',
                          border: '1px solid #e2e8f0',
                          verticalAlign: 'top',
                          background: hasConflict
                            ? '#fee2e2'
                            : isBusy
                            ? '#f0fdf4'
                            : 'transparent'
                        }}
                      >
                        {!isBusy ? (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            🟢 Disponible
                          </span>
                        ) : (
                          occs.map((occ, oIdx) => (
                            <div
                              key={oIdx}
                              style={{
                                background: hasConflict ? '#fca5a5' : '#dcfce7',
                                border: `1px solid ${hasConflict ? '#ef4444' : '#86efac'}`,
                                borderRadius: '6px',
                                padding: '0.4rem',
                                marginBottom: '0.25rem',
                                fontSize: '0.8rem',
                                color: hasConflict ? '#991b1b' : '#166534'
                              }}
                            >
                              <strong>{occ.classeName}</strong>
                              <div style={{ fontSize: '0.75rem' }}>{occ.subjectName}</div>
                              <div style={{ fontSize: '0.7rem', color: '#475569' }}>{occ.time}</div>
                              {hasConflict && <div style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>🚨 Conflit de salle !</div>}
                            </div>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useContext, useEffect, useState } from 'react';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import { normalizeSchedule, timeToMinutes } from '../../../utils/scheduleEvents';

const TYPE_COLOR = { COURSE: '#3b82f6', BREAK: '#94a3b8', CUSTOM_EVENT: '#a855f7' };

// Emploi du temps du jour d'un élève, déduit de l'EDT actif de sa classe.
export default function StudentDailyScheduleWidget({ classId }) {
  const { dynamicSubjects } = useContext(AiAdminContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/schedules?classeId=${classId}&activeOnly=true`);
        if (!res.ok) throw new Error('schedule');
        const json = await res.json();
        const schedule = Array.isArray(json.data) ? json.data[0] : null;
        // Les anciens EDT n'ont que `planning` : normalizeSchedule les convertit.
        const all = schedule ? (normalizeSchedule(schedule).events || []) : [];
        const today = new Date().getDay();
        if (alive) {
          setEvents(
            all
              .filter((e) => e.dayOfWeek === today)
              .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
          );
        }
      } catch (_) {
        if (alive) setEvents([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [classId]);

  const subjectName = (subjectId) => {
    if (!subjectId) return null;
    const id = subjectId?._id || subjectId;
    const s = (dynamicSubjects || []).find((x) => String(x.id) === String(id));
    return s?.nom || subjectId?.nom || null;
  };

  if (loading) return <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Chargement de l'emploi du temps…</p>;
  if (!classId) return <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Aucune classe rattachée.</p>;

  const dayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (events.length === 0) {
    return (
      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
        Aucun cours prévu aujourd'hui ({dayLabel}). Bonne journée !
      </p>
    );
  }

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div>
      <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 0.6rem 0', textTransform: 'capitalize' }}>{dayLabel}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {events.map((e, i) => {
          const isNow = nowMin >= timeToMinutes(e.startTime) && nowMin < timeToMinutes(e.endTime);
          const title = e.type === 'COURSE' ? (subjectName(e.subjectId) || e.label || 'Cours') : (e.label || (e.type === 'BREAK' ? 'Pause' : 'Événement'));
          return (
            <div
              key={`${e.startTime}-${i}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.7rem',
                padding: '0.5rem 0.7rem', borderRadius: '8px',
                background: isNow ? '#eff6ff' : 'white',
                border: isNow ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                borderLeft: `4px solid ${TYPE_COLOR[e.type] || '#3b82f6'}`,
              }}
            >
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#475569', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {e.startTime}–{e.endTime}
              </span>
              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </span>
              {e.salleNom && (
                <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  📍 {e.salleNom}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

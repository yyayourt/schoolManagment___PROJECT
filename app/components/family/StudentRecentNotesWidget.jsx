'use client';

import { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { AiAdminContext } from '../../../stores/ai_adminContext';

const TYPE_LABEL = { CC: 'Contrôle continu', DS: 'Devoir surveillé', EX: 'Examen' };

// Vert / orange / rouge selon la note ramenée sur 20.
function noteColor(note, sur) {
  const base = sur ? (note / sur) * 20 : note;
  if (base >= 14) return '#16a34a';
  if (base >= 10) return '#ea580c';
  return '#dc2626';
}

export default function StudentRecentNotesWidget({ studentId, limit = 3, detailHref = null }) {
  const { dynamicSubjects } = useContext(AiAdminContext);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/notes?eleveId=${studentId}&limit=${limit}`);
        if (!res.ok) throw new Error('Notes indisponibles');
        const json = await res.json();
        if (alive) setNotes(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [studentId, limit]);

  const subjectName = (matiereId) => {
    const s = (dynamicSubjects || []).find((x) => String(x.id) === String(matiereId));
    return s?.nom || 'Matière';
  };

  if (loading) return <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Chargement des notes…</p>;
  if (error) return <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>{error}</p>;
  if (notes.length === 0) {
    return <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Aucune note saisie pour le moment.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {notes.map((n) => (
        <div
          key={n._id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'white',
            border: '1px solid #e2e8f0', borderRadius: '8px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
              {subjectName(n.matiereId)}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.titre} · {TYPE_LABEL[n.typeDevoir] || n.typeDevoir}
              {n.dateEvaluation ? ` · ${new Date(n.dateEvaluation).toLocaleDateString('fr-FR')}` : ''}
            </div>
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: noteColor(n.note, n.sur), whiteSpace: 'nowrap' }}>
            {n.note}<span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.8rem' }}>/{n.sur || 20}</span>
          </span>
        </div>
      ))}
      {detailHref && (
        <Link href={detailHref} style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
          Voir toutes les notes →
        </Link>
      )}
    </div>
  );
}

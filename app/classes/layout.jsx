"use client"

import { useContext, useState, useMemo } from 'react';
import Link from 'next/link';
import ClasseCard from './ClasseCard';
import { AiAdminContext } from '../../stores/ai_adminContext';
import LoadingState from '../components/ui/LoadingState';

export default function ClassesPage({ children }) {

  const ctx = useContext(AiAdminContext);
  if (!ctx) return <div style={{ color: 'red' }}>Erreur : AiAdminContext non trouvé. Vérifiez que l'application est bien entourée par le provider.</div>;
  const { classes = [], enseignants, eleves = [], setSelected, setShowModal, setEditType } = ctx;
  const [selectedYear, setSelectedYear] = useState(null); // null = toutes les années

  const featuredClass = useMemo(() => {
    if (!classes || classes.length === 0 || !eleves || eleves.length === 0) return null;
    
    const classPerformance = classes.map(c => {
      const classStudents = eleves.filter(e => String(e.current_classe) === String(c._id));
      if (classStudents.length === 0) return { ...c, avgPoints: 0, count: 0 };
      
      const totalPoints = classStudents.reduce((sum, e) => {
        const bonusCount = Array.isArray(e.bonus) ? e.bonus.length : 0;
        const manusCount = Array.isArray(e.manus) ? e.manus.length : 0;
        return sum + (bonusCount - manusCount);
      }, 0);
      
      return {
        ...c,
        avgPoints: totalPoints / classStudents.length,
        count: classStudents.length
      };
    });

    const sorted = [...classPerformance].sort((a, b) => b.avgPoints - a.avgPoints);
    const top = sorted[0];
    
    if (top.avgPoints === 0) {
      const sortedByCount = [...classPerformance].sort((a, b) => b.count - a.count);
      return { ...sortedByCount[0], avgPoints: 0 };
    }
    
    return top;
  }, [classes, eleves]);

  return (<>
    <h2 className="page-title">Liste des classes</h2>

    <div className="classes-stats-grid">
      <div className="classes-stats-card">
        <span className="classes-stats-card__icon">🏫</span>
        <div className="classes-stats-card__info">
          <span className="classes-stats-card__value">{classes.length}</span>
          <span className="classes-stats-card__label">Classes</span>
        </div>
      </div>
      <div className="classes-stats-card">
        <span className="classes-stats-card__icon">👨‍🎓</span>
        <div className="classes-stats-card__info">
          <span className="classes-stats-card__value">{eleves.length}</span>
          <span className="classes-stats-card__label">Élèves</span>
        </div>
      </div>
      <div className="classes-stats-card">
        <span className="classes-stats-card__icon">📈</span>
        <div className="classes-stats-card__info">
          <span className="classes-stats-card__value">{classes.length ? Math.round(eleves.length / classes.length) : 0}</span>
          <span className="classes-stats-card__label">Moyenne / Classe</span>
        </div>
      </div>
      {featuredClass && (
        <div className="classes-stats-card --featured">
          <div className="classes-stats-card__badge">🏆 CLASSE ÉTOILE</div>
          <span className="classes-stats-card__icon">🌟</span>
          <div className="classes-stats-card__info">
            <span className="classes-stats-card__value --small">
              {featuredClass.niveau} {featuredClass.alias}
            </span>
            <span className="classes-stats-card__label">
              Moyenne : {featuredClass.avgPoints > 0 ? `+${featuredClass.avgPoints.toFixed(1)}` : featuredClass.avgPoints.toFixed(1)} pts
            </span>
          </div>
        </div>
      )}
    </div>

    <div className="ecole-admin__nav-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
      <Link href="/scheduling" className="ecole-admin__nav-link-item">
        <span className="icon">📅</span> Planning (EDT)
      </Link>
      <Link href="/calendar" className="ecole-admin__nav-link-item">
        <span className="icon">📆</span> Agenda école
      </Link>
      <Link href="/socle-commun" className="ecole-admin__nav-link-item">
        <span className="icon">🎯</span> Socle Commun
      </Link>
      <Link href="/brevet-dnb" className="ecole-admin__nav-link-item">
        <span className="icon">🎓</span> Brevet DNB
      </Link>
      <Link href="/orientation" className="ecole-admin__nav-link-item">
        <span className="icon">🧭</span> Orientation 3ème
      </Link>
      <Link href="/stages-3eme" className="ecole-admin__nav-link-item">
        <span className="icon">💼</span> Stages 3ème
      </Link>
      <Link href="/dispositifs-inclusifs" className="ecole-admin__nav-link-item">
        <span className="icon">🤝</span> Dispositifs Inclusifs
      </Link>
    </div>

    {classes ?
      <div className="classes-list">
        {(() => {
          // Filtrer les classes selon l'année sélectionnée
          const filteredClasses = selectedYear
            ? classes.filter(c => c.annee === selectedYear)
            : classes;

          // Grouper les classes filtrées par année
          const classesByYear = filteredClasses.reduce((acc, classe) => {
            const year = classe.annee || 'Sans année';
            if (!acc[year]) acc[year] = [];
            acc[year].push(classe);
            return acc;
          }, {});

          // Trier les années par ordre décroissant (plus récente en premier)
          const sortedYears = Object.keys(classesByYear).sort((a, b) => {
            if (a === 'Sans année') return 1;
            if (b === 'Sans année') return -1;
            return b.localeCompare(a);
          });

          return sortedYears.map(year => {
            // Grouper par niveau au sein de l'année
            const classesByLevel = classesByYear[year].reduce((acc, classe) => {
              const level = classe.niveau || 'Sans niveau';
              if (!acc[level]) acc[level] = [];
              acc[level].push(classe);
              return acc;
            }, {});

            const niveauOrder = ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'];
            const sortedLevels = Object.keys(classesByLevel).sort((a, b) => {
              const indexA = niveauOrder.indexOf(a);
              const indexB = niveauOrder.indexOf(b);
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              return a.localeCompare(b);
            });

            return (
              <div key={year} className="classes-list__year-group">
                <div className="classes-list__year-content">
                  {sortedLevels.map(level => (
                    <div key={level} className={`classes-list__level-group classes-list__level-group--multiple`}>
                      {classesByLevel[level].length > 1 && (
                        <h3 className="classes-list__level-title">{level}</h3>
                      )}
                      <div className="classes-list__level-content">
                        {classesByLevel[level].map(classe => (
                          <ClasseCard
                            key={classe._id}
                            classe={classe}
                            enseignants={enseignants}
                            eleves={eleves.filter(e => e.current_classe === classe._id)}
                            onEdit={e => { setSelected(e); setEditType("classe"); setShowModal(true); }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          });
        })()}
      </div>
      :
      <LoadingState label="Chargement des classes…" />
    }

    {children}
  </>
  );
}

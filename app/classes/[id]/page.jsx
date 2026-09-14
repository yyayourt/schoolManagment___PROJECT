"use client"

import { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from 'next/link';
import { AiAdminContext } from '../../../stores/ai_adminContext';
import { useUserRole } from '../../../stores/useUserRole';
import { getClasseImagePath, getEleveImagePath, getEnseignantImagePath } from '../../../utils/imageUtils';
import { PersonDetailCard, DetailEmpty } from '../../components/ui/detailCards';
import ScheduleViewer from '../../components/ScheduleViewer';
import EntityModal from '../../components/EntityModal';
import DetailPortal from "../../components/DetailPortal";
import PermissionGate from "../../components/PermissionGate";
import NotesBlock from '../../components/NotesBlock';
import SaisieNotesCollege from '../../components/SaisieNotesCollege';
import AddStudentsModal from '../../components/AddStudentsModal';
import ClassPointsPanel from '../../components/points/ClassPointsPanel';
import AttendancePanel from '../../components/attendance/AttendancePanel';
import HomeworkPanel from '../../components/homework/HomeworkPanel';
import ReportCardsPanel from '../../components/bulletins/ReportCardsPanel';
import EventsPanel from '../../components/events/EventsPanel';
import VisioLauncher from '../../components/visio/VisioLauncher';
import ClassDocuments from '../../components/documents/ClassDocuments';
import TeacherReportModule from '../../components/TeacherReportModule';
import ImageScanner from '../../components/ui/ImageScanner';
import ReviewModal from '../../components/ui/ReviewModal';
import UnifiedFeed from '../../components/feed/UnifiedFeed';
import ClassBookPanel from '../../components/classbook/ClassBookPanel';
import ClassGamesWidget from '../../components/games/ClassGamesWidget';

export default function ClasseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const ctx = useContext(AiAdminContext);
  const { userRole, userData, isProf } = useUserRole();
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [validatedScannedData, setValidatedScannedData] = useState(null);
  const reviewRef = useRef(null);
  const editBtnRef = useRef(null);
  const [dynamicSubjects, setDynamicSubjects] = useState([]);
  const [highlightEdit, setHighlightEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (id === 'class123') {
      setActiveTab('pedagogie');
    }
  }, [id]);

  useEffect(() => {
    // Charger les matières pour l'affichage des noms dans les coefficients
    const loadSubjects = async () => {
      const { getLSItem, setLSItem } = await import('../../../utils/localStorageManager');
      const parsed = getLSItem('app_subjects');
      if (parsed) {
        setDynamicSubjects(parsed.map(s => typeof s === 'string' ? { id: s, nom: s } : s));
      } else {
        const res = await fetch('/api/subjects');
        const data = await res.json();
        if (data.success) {
          const subjects = data.data.map(s => ({ id: s._id, nom: s.nom }));
          setDynamicSubjects(subjects);
          setLSItem('app_subjects', subjects);
        }
      }
    };
    loadSubjects();
  }, []);

  const { setSelected, showModal, setShowModal, setEditType } = ctx || {};
  const classe = useMemo(() => (ctx?.classes || []).find(c => String(c._id) === String(id)), [ctx?.classes, id]);

  const searchParams = useSearchParams();
  const urlYear = searchParams.get('year');

  const [selectedYear, setSelectedYear] = useState(urlYear || "");

  // Update selected year if URL changes
  useEffect(() => {
    if (urlYear && urlYear !== selectedYear) {
      setSelectedYear(urlYear);
    }
  }, [urlYear]);

  // Initialisation de l'année sélectionnée
  useEffect(() => {
    if (classe && !selectedYear && !urlYear) {
      setSelectedYear(classe.annee);
    }
  }, [classe, urlYear]);

  const historyOptions = useMemo(() => {
    if (!classe) return [];
    return [classe.annee, ...(classe.history || []).map(h => h.annee)];
  }, [classe]);

  const currentData = useMemo(() => {
    if (!classe) return null;
    if (selectedYear === classe.annee) return classe;
    return (classe.history || []).find(h => h.annee === selectedYear) || classe;
  }, [classe, selectedYear]);

  const isViewCurrentYear = !classe || selectedYear === classe.annee;

  const eleves = useMemo(() => {
    if (!currentData) return [];
    return isViewCurrentYear
      ? (ctx?.eleves || []).filter(e => e.current_classe === id)
      : (currentData.eleves || []);
  }, [isViewCurrentYear, ctx?.eleves, currentData, id]);

  const enseignants = useMemo(() => {
    if (!currentData) return [];
    return isViewCurrentYear
      ? (ctx?.enseignants || []).filter(e =>
        Array.isArray(e.current_classes) && e.current_classes.includes(id)
      )
      : (currentData.professeur || []);
  }, [isViewCurrentYear, ctx?.enseignants, currentData, id]);

  if (!ctx) return <div style={{ color: 'red' }}>Erreur : contexte non trouvé</div>;
  if (!classe) return <div style={{ color: 'red' }}>Classe introuvable</div>;
  if (!currentData) return <div>Chargement...</div>;

  const hasCoefficients = currentData.coefficients && Object.keys(currentData.coefficients).length > 0;

  const onEdit = e => { setSelected(e); setEditType("classe"); setShowModal(true); }

  const yearSelect = historyOptions.length > 1 ? (
    <select
      className="detailModal__titleScolarityYear"
      value={selectedYear}
      onChange={(e) => setSelectedYear(e.target.value)}
      onClick={(e) => e.stopPropagation()}
    >
      {historyOptions.map(yr => (
        <option key={yr} value={yr}>{yr}</option>
      ))}
    </select>
  ) : (
    <span className="detailModal__titleScolarityYear">{classe.annee}</span>
  );

  const scrollToEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setHighlightEdit(true);
    editBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightEdit(false), 3000);
  };

  return !classe ? <div>....loading.....</div>
    :
    <DetailPortal
      isOpen={true}
      onClose={() => router.back()}
      title={`${classe.niveau} ${classe.alias}`}
      icon={"🏦"}
      headerControls={yearSelect}
    ><main className="person-detail">
        <PermissionGate roles={['admin', 'prof']}>
          {onEdit && !showModal && isViewCurrentYear && (
            <button
              ref={editBtnRef}
              type="button"
              className={`person-detail__editbtn ${highlightEdit ? '--highlight' : ''}`}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                onEdit(classe);
              }}
              tabIndex={0}
            >Éditer</button>
          )}
          {showModal && <button
            className="person-detail__editbtn"
            onClick={e => { e.stopPropagation(); e.preventDefault(); setShowModal(false); }}
          >Fermer Édition</button>}
        </PermissionGate>
        {/* En-tête de la classe */}
        <div className="person-detail__header">
          <div className="person-detail__header-content">
            <div className="person-detail__header-info">
              <h1 className="person-detail__title">
                <Link href={`/classes/${classe._id}`}>
                  {classe.niveau} {classe.alias}
                </Link>
              </h1>
              <p className="person-detail__subtitle-text">
                Année scolaire {currentData.annee}
              </p>
            </div>
            <div className="person-detail__header-image">
              <img
                className="person-detail__photo"
                src={getClasseImagePath(currentData)}
                alt={`${classe.niveau} ${classe.alias} - ${currentData.annee}`}
                onError={(e) => {
                  e.target.src = '/school/classe.webp';
                }}
              />
            </div>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div className="person-detail__stats">
          <div className="person-detail__stat-card">
            <div className="person-detail__stat-icon">👨‍🎓</div>
            <div className="person-detail__stat-content">
              <span className="person-detail__stat-number">{eleves.length}</span>
              <span className="person-detail__stat-label">Élèves</span>
            </div>
          </div>
          <div className="person-detail__stat-card">
            <div className="person-detail__stat-icon">👨‍🏫</div>
            <div className="person-detail__stat-content">
              <span className="person-detail__stat-number">{enseignants.length}</span>
              <span className="person-detail__stat-label">Enseignants</span>
            </div>
          </div>
          <div className="person-detail__stat-card">
            <div className="person-detail__stat-icon">📚</div>
            <div className="person-detail__stat-content">
              <span className="person-detail__stat-number">{classe.niveau}</span>
              <span className="person-detail__stat-label">Niveau</span>
            </div>
          </div>
        </div>

        {/* Tab switcher navigation bar */}
        <div className="ecole-detail-tabs">
          <button
            type="button"
            className={`ecole-detail-tab-btn ${activeTab === 'general' ? '--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            🗂️ Général & Ressources
          </button>
          <button
            type="button"
            className={`ecole-detail-tab-btn ${activeTab === 'vie-scolaire' ? '--active' : ''}`}
            onClick={() => setActiveTab('vie-scolaire')}
          >
            👨‍🎓 Élèves & Vie Scolaire
          </button>
          <button
            type="button"
            className={`ecole-detail-tab-btn ${activeTab === 'pedagogie' ? '--active' : ''}`}
            onClick={() => setActiveTab('pedagogie')}
          >
            📊 Notes & Devoirs
          </button>
          {(userRole === 'admin' || isProf) && (
            <button
              type="button"
              className={`ecole-detail-tab-btn ${activeTab === 'gestion' ? '--active' : ''}`}
              onClick={() => setActiveTab('gestion')}
            >
              ⚙️ Gestion & Outils
            </button>
          )}
        </div>

        {/* Tab 1: Général & Actualité */}
        {activeTab === 'general' && (
          <>
            {/* Fil d'actualité et Sondages de la classe */}
            <div className="person-detail__block person-detail__block--feed">
              <h2 className="person-detail__subtitle">
                <span className="person-detail__subtitle-icon">💬</span>
                Fil d'actualité & Sondages
              </h2>
              <UnifiedFeed contextType="class" contextId={id} />
            </div>

            {/* Documents de cours — consultation pour tous, dépôt/suppression réservé prof/admin */}
            <div className="person-detail__block person-detail__block--documents">
              <h2 className="person-detail__subtitle">
                <span className="person-detail__subtitle-icon">📄</span>
                Documents de cours
              </h2>
              <ClassDocuments
                classId={classe._id}
                canManage={(userRole === 'admin' || isProf) && isViewCurrentYear}
              />
            </div>

            {/* Jeux pédagogiques — accès ouvert à tous, filtrés sur le niveau de la classe */}
            <div className="person-detail__block person-detail__block--games">
              <h2 className="person-detail__subtitle">
                <span className="person-detail__subtitle-icon">🎮</span>
                Jeux pédagogiques
              </h2>
              <ClassGamesWidget
                classe={classe}
                canManage={(userRole === 'admin' || isProf) && isViewCurrentYear}
              />
            </div>
          </>
        )}

        {/* Tab 2: Élèves & Vie Scolaire */}
        {activeTab === 'vie-scolaire' && (
          <>
            {/* Liste des élèves */}
            <div className="person-detail__block person-detail__block--students">
              <h2 className="person-detail__subtitle">
                <span className="person-detail__subtitle-icon">👨‍🎓</span>
                Liste des élèves
                <PermissionGate roles={['admin', 'prof']}>
                  {isViewCurrentYear && (
                    <button
                      className="person-detail__addBtn"
                      onClick={() => setShowAddStudentsModal(true)}
                      title="Ajouter des élèves à cette classe"
                    >
                      + Ajouter
                    </button>
                  )}
                </PermissionGate>
              </h2>
              {eleves.length === 0 ? (
                <DetailEmpty icon="📚" text="Aucun élève dans cette classe" />
              ) : (
                <div className="person-detail__grid">
                  {eleves.map(eleve => {
                    const student = ctx.eleves.find(el => el._id === (eleve._id || eleve));
                    if (!student) return null;
                    const imagePath = getEleveImagePath(student);
                    return (
                      <PersonDetailCard
                        key={"eleves_" + student._id}
                        href={`/eleves/${student._id}?year=${selectedYear}`}
                        imgSrc={imagePath}
                        fallbackSrc="/school/student.webp"
                        alt={`${student.nom} ${student.prenoms}`}
                        name={`${student.nom} ${student.prenoms}`}
                        role="Élève"
                      />
                    )
                  }).filter(Boolean)}
                </div>
              )}
            </div>

            {/* Liste des enseignants */}
            <div className="person-detail__block person-detail__block--teachers">
              <h2 className="person-detail__subtitle">
                <span className="person-detail__subtitle-icon">👨‍🏫</span>
                Enseignants attitrés
              </h2>
              {enseignants.length === 0 ? (
                <DetailEmpty icon="👨‍🏫" text="Aucun enseignant attitré" />
              ) : (
                <div className="person-detail__grid">
                  {enseignants.map(enseignant => {
                    const teacher = ctx.enseignants.find(el => el._id === (enseignant._id || enseignant));
                    if (!teacher) return null;
                    return (
                      <PersonDetailCard
                        key={teacher._id}
                        href={`/enseignants/${teacher._id}`}
                        imgSrc={getEnseignantImagePath(teacher)}
                        fallbackSrc="/school/prof.webp"
                        alt={`${teacher.nom} ${teacher.prenoms}`}
                        name={`${teacher.nom} ${teacher.prenoms}`}
                        role="Enseignant"
                      />
                    )
                  }).filter(Boolean)}
                </div>
              )}
              <TeacherReportModule initialClasseId={classe._id} />
            </div>

            {/* Livre de classe (Yearbook) — réservé profs/admins, année courante */}
            <PermissionGate roles={['admin', 'prof']}>
              {isViewCurrentYear && (
                <div className="person-detail__block person-detail__block--classbook">
                  <h2 className="person-detail__subtitle">
                    <span className="person-detail__subtitle-icon">📖</span>
                    Livre de Classe (Yearbook)
                  </h2>
                  <ClassBookPanel
                    classId={classe._id}
                    classe={classe}
                    eleves={eleves.map(e => ctx.eleves.find(el => el._id === (e._id || e))).filter(Boolean)}
                  />
                </div>
              )}
            </PermissionGate>

            {/* Bons points — gestion par le prof (année courante uniquement) */}
            <PermissionGate roles={['admin', 'prof']}>
              {isViewCurrentYear && (
                <div className="person-detail__block person-detail__block--points">
                  <h2 className="person-detail__subtitle">
                    <span className="person-detail__subtitle-icon">🎖️</span>
                    Bons points
                  </h2>
                  <ClassPointsPanel eleves={eleves} />
                </div>
              )}
            </PermissionGate>

            {/* Section Emploi du temps */}
            <div className="person-detail__block person-detail__block--schedule">
              <ScheduleViewer
                classeId={classe._id}
                isEditable={userRole === 'admin'}
                mergeEvents
                onEditSchedule={(data) => {
                  if (data.action === 'create') {
                    router.push(`/scheduling?classeId=${classe._id}&view=editor`);
                  } else if (data.action === 'edit') {
                    router.push(`/scheduling?classeId=${classe._id}&view=editor&scheduleId=${data.schedule._id}`);
                  } else if (data.action === 'history') {
                    router.push(`/scheduling?classeId=${classe._id}&view=history`);
                  }
                }}
              />
            </div>
          </>
        )}

        {/* Tab 3: Notes & Devoirs */}
        {activeTab === 'pedagogie' && (
          <>
            {/* Section Notes et Compositions */}
            <div className="person-detail__block person-detail__block--notes">
              <h2 className="person-detail__subtitle">
                <span className="person-detail__subtitle-icon">📊</span>
                Notes et Compositions
              </h2>
              <NotesBlock
                eleves={eleves}
                classeId={classe._id}
                isCurrentYear={isViewCurrentYear}
                annee={currentData.annee}
                allSubjects={dynamicSubjects}
              />
              <PermissionGate roles={['admin', 'prof']} fallback={<div className="image-scanner__loader-mini"><span className="spinner"></span></div>}>
                <div className="person-detail__block person-detail__block--entry">
                  <h3 className="person-detail__subtitle person-detail__subtitle--sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="person-detail__subtitle-icon">✏️</span>
                      {hasCoefficients ? (
                        <div className="person-detail__coefficients-list" title="Coefficients configurés pour cette classe">
                          {Object.entries(currentData.coefficients || {}).map(([subId, coeff]) => {
                            const sub = dynamicSubjects.find(s => s.id === subId || s._id === subId);
                            return (
                              <span key={subId} className="person-detail__coeff-tag">
                                {sub ? sub.nom : `Mat. ${subId.slice(-4)}`}: <b>{coeff}</b>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="person-detail__no-coefficients">
                          ⚠️ Pas de coefficients définis.
                          <button onClick={scrollToEdit} className="person-detail__scroll-btn" title="Aller à l'édition de la classe">Définir maintenant</button>
                        </div>
                      )}
                    </div>
                    <ImageScanner
                      classeId={classe._id}
                      subjects={dynamicSubjects}
                      label="Scanner Notes IA"
                      className="--compact"
                      disabled={!hasCoefficients || !isViewCurrentYear}
                      title={!hasCoefficients ? "Veuillez définir les coefficients de la classe avant de scanner des notes (cliquez sur 'Définir maintenant')" : "Scanner une liste de notes avec l'IA"}
                      onScanComplete={(result) => {
                        console.log('Scan completed', result);
                        if (result.success) {
                          setScanResult(result);
                          setTimeout(() => {
                            reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 100);
                        } else {
                          alert(result.error || "Erreur lors du scan");
                        }
                      }}
                    />
                  </h3>

                  <div ref={reviewRef}>
                    {scanResult && scanResult.success && scanResult.file && (
                      <ReviewModal
                        file={scanResult.file}
                        extractedData={scanResult.data}
                        students={eleves}
                        subjects={dynamicSubjects}
                        coefficients={currentData.coefficients || {}}
                        onClose={() => setScanResult(null)}
                        onValidate={(data) => {
                          console.log("Validation en cours avec les données:", data);
                          setValidatedScannedData(data);
                          setScanResult(null);
                        }}
                      />
                    )}
                  </div>

                  {(!scanResult || validatedScannedData) && (
                    <SaisieNotesCollege
                      preselectedClasseId={classe._id}
                    />
                  )}
                </div>
              </PermissionGate>
            </div>

            {/* Cahier de texte — saisie des devoirs réservée au prof, année courante uniquement */}
            <PermissionGate roles={['admin', 'prof']}>
              {isViewCurrentYear && (
                <div className="person-detail__block person-detail__block--homework">
                  <h2 className="person-detail__subtitle">
                    <span className="person-detail__subtitle-icon">📓</span>
                    Cahier de texte
                  </h2>
                  <HomeworkPanel classId={classe._id} />
                </div>
              )}
            </PermissionGate>

            {/* Bulletins — génération réservée au prof, année courante uniquement */}
            <PermissionGate roles={['admin', 'prof']}>
              {isViewCurrentYear && (
                <div className="person-detail__block person-detail__block--bulletins">
                  <h2 className="person-detail__subtitle">
                    <span className="person-detail__subtitle-icon">🎓</span>
                    Bulletins
                  </h2>
                  <ReportCardsPanel
                    classId={classe._id}
                    eleves={eleves}
                    defaultYear={classe.annee}
                    className={`${classe.niveau || ''} ${classe.alias || ''}`.trim()}
                  />
                </div>
              )}
            </PermissionGate>
          </>
        )}

        {/* Tab 4: Gestion & Outils */}
        {activeTab === 'gestion' && (userRole === 'admin' || isProf) && (
          <>
            {/* Appel / présences — réservé au prof, année courante uniquement */}
            <PermissionGate roles={['admin', 'prof']}>
              {isViewCurrentYear && (
                <div className="person-detail__block person-detail__block--attendance">
                  <h2 className="person-detail__subtitle">
                    <span className="person-detail__subtitle-icon">📋</span>
                    Faire l'appel
                  </h2>
                  <AttendancePanel classId={classe._id} eleves={eleves} />
                </div>
              )}
            </PermissionGate>

            {/* Événements — création/édition réservée prof/admin, année courante uniquement */}
            <PermissionGate roles={['admin', 'prof']}>
              {isViewCurrentYear && (
                <div className="person-detail__block person-detail__block--events">
                  <h2 className="person-detail__subtitle">
                    <span className="person-detail__subtitle-icon">📅</span>
                    Événements
                  </h2>
                  <EventsPanel classId={classe._id} interactive canGlobal={userRole === 'admin'} />
                </div>
              )}
            </PermissionGate>

            {/* Visio de classe — le staff lance/rejoint et peut capturer des souvenirs (album de classe) */}
            <PermissionGate roles={['admin', 'prof']}>
              {isViewCurrentYear && (
                <div className="person-detail__block person-detail__block--visio">
                  <h2 className="person-detail__subtitle">
                    <span className="person-detail__subtitle-icon">🎥</span>
                    Visioconférence de classe
                  </h2>
                  <p className="person-detail__hint">
                    Lancez un cours à distance. Le bouton 📸 enregistre des photos dans la galerie de la classe.
                  </p>
                  <VisioLauncher
                    roomName={`ecole-classe-${classe._id}`}
                    title={`Visio · ${classe.niveau || ''} ${classe.alias || ''}`.trim()}
                    variant="launch"
                    canCapture
                    albumTarget={{ classId: classe._id }}
                  />
                </div>
              )}
            </PermissionGate>
          </>
        )}

        {/* Modal d'ajout d'élèves */}
        <AddStudentsModal
          isOpen={showAddStudentsModal}
          onClose={() => setShowAddStudentsModal(false)}
          classeId={classe._id}
          classeName={`${classe.niveau} ${classe.alias}`}
          classeAnnee={classe.annee}
          currentStudents={eleves.map(e => e._id || e)}
          onSuccess={() => {
            // Rafraîchir les données
            ctx.fetchEleves && ctx.fetchEleves();
            ctx.fetchClasses && ctx.fetchClasses();
          }}
        />

      </main>
    </DetailPortal>
}

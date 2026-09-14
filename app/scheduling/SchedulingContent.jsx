'use client';

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUserRole } from '../../stores/useUserRole'
import PermissionGate from '../components/PermissionGate'
import ScheduleManager from '../components/ScheduleManager'
import ScheduleHistory from '../components/ScheduleHistory'
import ScheduleEditor from '../components/ScheduleEditor'
import SubjectsPalette from '../components/SubjectsPalette'
import RoomScheduleViewer from '../components/RoomScheduleViewer'

export default function SchedulingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { userRole, loading } = useUserRole()

  const [currentView, setCurrentView] = useState('manager')
  const [selectedClasseId, setSelectedClasseId] = useState(null)
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [selectedClasse, setSelectedClasse] = useState(null)
  const [allClasses, setAllClasses] = useState([])

  // Récupération des paramètres URL
  useEffect(() => {
    const classeId = searchParams.get('classeId')
    const view = searchParams.get('view') || 'manager'
    const scheduleId = searchParams.get('scheduleId')

    if (classeId) {
      setSelectedClasseId(classeId)
    }

    if (view === 'editor' && scheduleId) {
      fetchSchedule(scheduleId)
    } else if (view !== 'editor') {
      setSelectedSchedule(null)
    }

    setCurrentView(view)
  }, [searchParams])

  const fetchSchedule = async (scheduleId) => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setSelectedSchedule(data.data)
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'emploi du temps:', error)
    }
  }

  // Chargement de toutes les classes au montage
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const response = await fetch('/api/school_ai/classes', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setAllClasses(data)
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des classes:', error)
      }
    }
    loadClasses()
  }, [])

  // Mise à jour de la classe sélectionnée
  useEffect(() => {
    if (selectedClasseId && allClasses.length > 0) {
      setSelectedClasse(allClasses.find(c => c._id === selectedClasseId) || null)
    } else {
      setSelectedClasse(null)
    }
  }, [selectedClasseId, allClasses])

  // Gestion de la navigation
  const handleViewChange = (view, options = {}) => {
    setCurrentView(view)

    if (options.schedule) {
      setSelectedSchedule(options.schedule)
    }

    // Mise à jour de l'URL
    const params = new URLSearchParams(searchParams) // Conserver les params existants
    if (view !== 'manager') {
      params.set('view', view)
    } else {
      params.delete('view') // Nettoyer l'URL pour la vue par défaut
    }
    
    if (options.schedule && options.schedule._id) {
      params.set('scheduleId', options.schedule._id)
    } else {
      params.delete('scheduleId')
    }

    const newUrl = `/scheduling${params.toString() ? '?' + params.toString() : ''}`
    router.push(newUrl, { scroll: false })
  }

  // Gestion de la sélection de classe
  const handleClasseSelect = (classeId) => {
    setSelectedClasseId(classeId)
    const params = new URLSearchParams(searchParams)
    params.set('classeId', classeId)

    router.push(`/scheduling?${params.toString()}`, { scroll: false })
  }

  if (loading) {
    return (
      <div className="scheduling__loading">
        <div className="scheduling__loading-spinner"></div>
        <p>Chargement des permissions...</p>
      </div>
    )
  }

  return (
    <PermissionGate role="admin">
      <div className="scheduling__top-back-link">
        <Link href="/classes" className="scheduling__back-btn">
          <span className="icon">⬅️</span> Retour aux classes
        </Link>
      </div>
      <main className="scheduling">
        <header className="scheduling__header">
          <div className="scheduling__header-content">
            <h1 className="scheduling__title">
              📅 {selectedClasse
                ? `Emplois du Temps - ${selectedClasse.niveau} ${selectedClasse.alias} (${selectedClasse.annee})`
                : 'Gestion des Emplois du Temps'
              }
            </h1>
            <p className="scheduling__subtitle">
              {selectedClasse
                ? `Gérez les emplois du temps de la classe ${selectedClasse.niveau} ${selectedClasse.alias}`
                : 'Créez, modifiez et gérez les emplois du temps de vos classes'
              }
            </p>
          </div>

          <nav className="scheduling__nav">
            <button
              className={`scheduling__nav-btn ${currentView === 'manager' ? 'scheduling__nav-btn--active' : ''}`}
              onClick={() => handleViewChange('manager')}
            >
              <span className="scheduling__nav-btn-icon">🏠</span>
              Gestionnaire
            </button>
            <button
              className={`scheduling__nav-btn ${currentView === 'history' ? 'scheduling__nav-btn--active' : ''}`}
              onClick={() => handleViewChange('history')}
              disabled={!selectedClasseId}
            >
              <span className="scheduling__nav-btn-icon">📚</span>
              Historique {selectedClasse?.niveau}-{selectedClasse?.alias}
            </button>
            <button
              className={`scheduling__nav-btn ${currentView === 'editor' ? 'scheduling__nav-btn--active' : ''}`}
              onClick={() => handleViewChange('editor')}
              disabled={!selectedClasseId}
            >
              <span className="scheduling__nav-btn-icon">✏️</span>
              Éditeur {selectedClasse?.niveau}-{selectedClasse?.alias}
            </button>
            <button
              className={`scheduling__nav-btn ${currentView === 'subjects' ? 'scheduling__nav-btn--active' : ''}`}
              onClick={() => handleViewChange('subjects')}
            >
              <span className="scheduling__nav-btn-icon">🎨</span>
              Matières
            </button>
            <button
              className={`scheduling__nav-btn ${currentView === 'rooms' ? 'scheduling__nav-btn--active' : ''}`}
              onClick={() => handleViewChange('rooms')}
            >
              <span className="scheduling__nav-btn-icon">🏛️</span>
              Occupation par Salle
            </button>
            <a
              href="/calendar"
              target="_blank"
              rel="noopener noreferrer"
              className="scheduling__nav-btn"
              style={{ textDecoration: 'none' }}
              title="Ouvrir l'agenda de l'école dans un nouvel onglet"
            >
              <span className="scheduling__nav-btn-icon">📆</span>
              Agenda école ↗
            </a>
          </nav>
        </header>

        <div className="scheduling__content">
          {currentView === 'rooms' && (
            <RoomScheduleViewer />
          )}
          {currentView === 'manager' && (
            <>
              <ScheduleManager
                selectedClasseId={selectedClasseId}
                onClasseSelect={handleClasseSelect}
                onViewChange={handleViewChange}
              />
              <div className="scheduling__palette-wrapper">
                <SubjectsPalette classeId={selectedClasseId} />
              </div>
            </>
          )}

          {currentView === 'history' && selectedClasseId && (
            <>
              <ScheduleHistory
                classeId={selectedClasseId}
                onEditSchedule={(schedule) => handleViewChange('editor', { schedule })}
                onBackToManager={() => handleViewChange('manager')}
              />
              <div className="scheduling__palette-wrapper">
                <SubjectsPalette classeId={selectedClasseId} />
              </div>
            </>
          )}

          {currentView === 'editor' && selectedClasseId && (
            <ScheduleEditor
              classeId={selectedClasseId}
              classe={selectedClasse}
              schedule={selectedSchedule}
              onSave={() => handleViewChange('manager')}
              onCancel={() => handleViewChange('manager')}
            />
          )}

          {(currentView === 'editor' || currentView === 'history') && !selectedClasseId && (
            <div className="scheduling__empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '3rem', marginBottom: '15px' }}>🏫</span>
              <h2 style={{ color: '#1a237e', marginBottom: '10px', fontSize: '1.5rem' }}>Sélectionnez une classe</h2>
              <p style={{ color: '#546e7a', marginBottom: '30px', maxWidth: '400px' }}>Vous devez choisir une classe pour accéder à l'éditeur ou à l'historique.</p>
              
              <select 
                value=""
                onChange={(e) => handleClasseSelect(e.target.value)}
                style={{
                  padding: '12px 20px',
                  fontSize: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #cfd8dc',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer',
                  outline: 'none',
                  minWidth: '300px',
                  color: '#263238'
                }}
              >
                <option value="" disabled>-- Choisir une classe --</option>
                {allClasses.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.niveau} {c.alias} ({c.annee})
                  </option>
                ))}
              </select>
            </div>
          )}

          {currentView === 'subjects' && (
            <div className="scheduling__subjects-view">
              <SubjectsPalette classeId={selectedClasseId} />
            </div>
          )}
        </div>
      </main>
    </PermissionGate>
  )
}

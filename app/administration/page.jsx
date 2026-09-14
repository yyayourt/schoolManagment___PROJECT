"use client"

import { useState, useContext, useEffect, useMemo } from 'react';
import { AiAdminContext } from '../../stores/ai_adminContext';
import { useUserRole } from '../../stores/useUserRole';
import PermissionGate from '../components/PermissionGate';
import Link from 'next/link';
import FeeConfigManager from '../components/FeeConfigManager';
import DesignSettingsManager from '../components/DesignSettingsManager';

/**
 * Page d'Administration
 * Permet de gérer les 3 schémas principaux : Élèves, Enseignants, Classes
 */
export default function AdministrationPage() {
    const {
        eleves, fetchEleves,
        enseignants, fetchEnseignants,
        classes, fetchClasses,
        fetchBootstrap,
        setSelected, setShowModal, setEditType
    } = useContext(AiAdminContext);

    const { isAdmin, loading: authLoading, clerkUser } = useUserRole();
    const [isMigrating, setIsMigrating] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [activeTab, setActiveTab] = useState('eleves'); // 'eleves', 'enseignants', 'classes', 'fees', 'design'
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchEleves();
        fetchEnseignants();
        fetchClasses();
    }, []);

    // Filtrage des données selon la recherche
    const filteredData = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (activeTab === 'eleves') {
            return eleves.filter(e =>
                e.nom?.toLowerCase().includes(query) ||
                e.prenoms?.toLowerCase().includes(query) ||
                e.matricule?.toLowerCase().includes(query)
            );
        } else if (activeTab === 'enseignants') {
            return enseignants.filter(e =>
                e.nom?.toLowerCase().includes(query) ||
                e.prenoms?.toLowerCase().includes(query) ||
                e.email_$_email?.toLowerCase().includes(query)
            );
        } else if (activeTab === 'classes') {
            return classes.filter(c =>
                c.niveau?.toLowerCase().includes(query) ||
                c.alias?.toLowerCase().includes(query) ||
                c.annee?.toLowerCase().includes(query)
            );
        }
        return [];
    }, [activeTab, searchQuery, eleves, enseignants, classes]);

    const handleMigrateYear = async () => {
        if (!confirm('⚠️ ATTENTION : Êtes-vous sûr de vouloir migrer TOUTES les classes à l\'année scolaire suivante ?\n\nCette action va :\n1. Archiver les élèves actuels dans l\'historique de chaque classe.\n2. Vider la liste des élèves pour la nouvelle année.\n3. Retirer les professeurs principaux.\n4. Mettre à jour l\'année scolaire (ex: 2024-2025 -> 2025-2026).')) {
            return;
        }

        try {
            const res = await fetch('/api/school_ai/admin/migrate', { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erreur lors de la migration');
            }
            const data = await res.json();
            alert(`✅ Succès : ${data.message}`);
            fetchClasses(true); // Recharger les classes en outrepassant le cache
        } catch (error) {
            console.error('Erreur migration:', error);
            alert(`❌ Erreur : ${error.message}`);
        }
    };

    const handleResetDemo = async () => {
        if (!confirm(`⚠️ ATTENTION : Êtes-vous sûr de vouloir réinitialiser la démo ?\n\nCette action va écraser les données actuelles de l'école démo pour regénérer les 6 années d'historique.`)) {
            return;
        }

        setIsResetting(true);
        try {
            const res = await fetch('/api/admin/reset-demo', { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erreur lors de la réinitialisation');
            }
            const data = await res.json();
            alert(`✅ Succès : ${data.message}`);
            
            // Nettoyer le LocalStorage et forcer le rechargement depuis l'API
            if (typeof window !== 'undefined') {
                localStorage.removeItem('classes');
                localStorage.removeItem('eleves');
                localStorage.removeItem('enseignants');
            }
            if (fetchBootstrap) {
                await fetchBootstrap(true);
            } else {
                fetchEleves(true);
                fetchEnseignants(true);
                fetchClasses(true);
            }
        } catch (error) {
            console.error('Erreur reset demo:', error);
            alert(`❌ Erreur : ${error.message}`);
        } finally {
            setIsResetting(false);
        }
    };

    const handleEdit = (item, type) => {
        setSelected(item);
        setEditType(type);
        setShowModal(true);
    };

    const handleAdd = (type) => {
        setSelected({});
        setEditType(type);
        setShowModal(true);
    };

    if (authLoading) return <div className="admin-page__loading">Vérification des accès...</div>;

    return (
        <PermissionGate role="admin" fallback={<div className="admin-page__denied">Accès réservé aux administrateurs.</div>}>
            <div className="admin-page">
                <header className="admin-page__header">
                    <div className="admin-page__header-top">
                        <Link href="/" className="admin-page__back">← Retour Accueil</Link>
                        <h1 className="admin-page__title">⚙️ Configuration du Système</h1>
                    </div>

                    <div className="admin-page__stats-row">
                        <div className="admin-page__stat-card">
                            <span className="admin-page__stat-icon">👨‍🎓</span>
                            <div className="admin-page__stat-info">
                                <span className="admin-page__stat-value">{eleves.length}</span>
                                <span className="admin-page__stat-label">Élèves</span>
                            </div>
                        </div>
                        <div className="admin-page__stat-card">
                            <span className="admin-page__stat-icon">👨‍🏫</span>
                            <div className="admin-page__stat-info">
                                <span className="admin-page__stat-value">{enseignants.length}</span>
                                <span className="admin-page__stat-label">Enseignants</span>
                            </div>
                        </div>
                        <div className="admin-page__stat-card">
                            <span className="admin-page__stat-icon">🏫</span>
                            <div className="admin-page__stat-info">
                                <span className="admin-page__stat-value">{classes.length}</span>
                                <span className="admin-page__stat-label">Classes</span>
                            </div>
                        </div>
                    </div>

                    <div className="admin-page__top-actions">
                        <div className="admin-page__schoolConfigs">
                            <button
                                className={`admin-page__config-btn ${activeTab === 'fees' ? '--active' : ''}`}
                                onClick={() => setActiveTab('fees')}
                            >
                                ⚙️ Paramètres des Frais
                            </button>
                            <button
                                className={`admin-page__config-btn ${activeTab === 'design' ? '--active' : ''}`}
                                onClick={() => setActiveTab('design')}
                                style={{ marginLeft: '10px' }}
                            >
                                🎨 Paramètres de Design
                            </button>
                        </div>
                    </div>

                    <nav className="admin-page__tabs">
                        <button
                            className={`admin-page__tab-btn ${activeTab === 'eleves' ? '--active' : ''}`}
                            onClick={() => setActiveTab('eleves')}
                        >
                            Élèves
                        </button>
                        <button
                            className={`admin-page__tab-btn ${activeTab === 'enseignants' ? '--active' : ''}`}
                            onClick={() => setActiveTab('enseignants')}
                        >
                            Enseignants
                        </button>
                        <button
                            className={`admin-page__tab-btn ${activeTab === 'classes' ? '--active' : ''}`}
                            onClick={() => setActiveTab('classes')}
                        >
                            Classes
                        </button>
                    </nav>

                    {activeTab !== 'fees' && activeTab !== 'design' && (
                        <div className="admin-page__controls">
                            <div className="admin-page__search-wrapper">
                                <input
                                    type="text"
                                    placeholder={`Rechercher un ${activeTab.slice(0, -1)}...`}
                                    className="admin-page__search-input"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button className="admin-page__add-btn" onClick={() => handleAdd(activeTab === 'eleves' ? 'eleve' : activeTab === 'enseignants' ? 'enseignant' : 'classe')}>
                                + Ajouter {activeTab === 'eleves' ? 'un élève' : activeTab === 'enseignants' ? 'un enseignant' : 'une classe'}
                            </button>
                        </div>
                    )}
                </header>

                <main className="admin-page__content">
                    {activeTab === 'fees' ? (
                        <div className="admin-page__dynamic-content">
                            <FeeConfigManager />
                        </div>
                    ) : activeTab === 'design' ? (
                        <div className="admin-page__dynamic-content">
                            <DesignSettingsManager
                                handleMigrateYear={handleMigrateYear}
                                handleResetDemo={handleResetDemo}
                                isResetting={isResetting}
                                clerkUser={clerkUser}
                            />
                        </div>
                    ) : (
                        <div className="admin-page__table-container">
                            <table className="admin-page__table">
                                <thead>
                                    {activeTab === 'eleves' && (
                                        <tr>
                                            <th>Élève</th>
                                            <th>Sexe</th>
                                            <th>Date de naissance</th>
                                            <th>Classe Actuelle</th>
                                            <th>Actions</th>
                                        </tr>
                                    )}
                                    {activeTab === 'enseignants' && (
                                        <tr>
                                            <th>Enseignant</th>
                                            <th>Email / Tel</th>
                                            <th>Sexe</th>
                                            <th>Classes</th>
                                            <th>Actions</th>
                                        </tr>
                                    )}
                                    {activeTab === 'classes' && (
                                        <tr>
                                            <th>Niveau / Alias</th>
                                            <th>Année</th>
                                            <th>Effectif</th>
                                            <th>Prof. Principal</th>
                                            <th>Actions</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {filteredData.length > 0 ? filteredData.map((item) => (
                                        <tr key={item._id}>
                                            {activeTab === 'eleves' && (
                                                <>
                                                    <td>
                                                        <div className="admin-page__item-identity">
                                                            <strong>{item.nom} {item.prenoms}</strong>
                                                            <span className="admin-page__item-id">{item._id.substring(0, 8)}</span>
                                                        </div>
                                                    </td>
                                                    <td>{item.sexe}</td>
                                                    <td>{item.naissance_$_date ? new Date(item.naissance_$_date).toLocaleDateString() : '-'}</td>
                                                    <td>{classes.find(c => c._id === item.current_classe)?.niveau || '-'}</td>
                                                </>
                                            )}
                                            {activeTab === 'enseignants' && (
                                                <>
                                                    <td>
                                                        <div className="admin-page__item-identity">
                                                            <strong>{item.nom} {item.prenoms}</strong>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="admin-page__item-contact">
                                                            <div>{item.email_$_email || '-'}</div>
                                                            <div className="--phone">{item.phone_$_tel || '-'}</div>
                                                        </div>
                                                    </td>
                                                    <td>{item.sexe}</td>
                                                    <td>{Array.isArray(item.current_classes) ? item.current_classes.length : 0}</td>
                                                </>
                                            )}
                                            {activeTab === 'classes' && (
                                                <>
                                                    <td>
                                                        <div className="admin-page__item-identity">
                                                            <strong>{item.niveau} {item.alias}</strong>
                                                        </div>
                                                    </td>
                                                    <td>{item.annee}</td>
                                                    <td>{eleves.filter(e => e.current_classe === item._id).length} élèves</td>
                                                    <td>{enseignants.find(e => e._id === item.prof_principal_id)?.nom || '-'}</td>
                                                </>
                                            )}
                                            <td>
                                                <div className="admin-page__actions">
                                                    <button className="admin-page__action-btn --edit" onClick={() => handleEdit(item, activeTab === 'eleves' ? 'eleve' : activeTab === 'enseignants' ? 'enseignant' : 'classe')}>Éditer</button>
                                                    <Link href={`/${activeTab}/${item._id}`} className="admin-page__action-btn --view">Voir</Link>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="admin-page__empty">Aucune donnée trouvée</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>

            </div>
        </PermissionGate>
    );
}

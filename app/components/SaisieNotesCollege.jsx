"use client"

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AiAdminContext } from '../../stores/ai_adminContext';
import { useUserRole } from '../../stores/useUserRole';

export default function SaisieNotesCollege({ preselectedClasseId = '' }) {
    const ctx = useContext(AiAdminContext);
    const { hasAnyRole } = useUserRole();
    const canEdit = hasAnyRole(['admin', 'prof']);

    const [selectedClasse, setSelectedClasse] = useState(preselectedClasseId);
    const [selectedMatiere, setSelectedMatiere] = useState('');
    const [trimestre, setTrimestre] = useState(1);
    
    // Paramètres du devoir
    const [titreDevoir, setTitreDevoir] = useState('');
    const [typeDevoir, setTypeDevoir] = useState('CC'); // CC, DS, EX
    const [poids, setPoids] = useState(1);
    const [surValeur, setSurValeur] = useState(20);
    const [dateEvaluation, setDateEvaluation] = useState(new Date().toISOString().split('T')[0]);
    
    const [notesDraft, setNotesDraft] = useState({}); 
    
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Filtrer les élèves de la classe
    const elevesClasse = useMemo(() => {
        if (!selectedClasse || !ctx.eleves) return [];
        return ctx.eleves.filter(e => e.current_classe === selectedClasse);
    }, [selectedClasse, ctx.eleves]);

    // Changement de type auto-ajuste le poids
    useEffect(() => {
        if (typeDevoir === 'DS') setPoids(2);
        else if (typeDevoir === 'EX') setPoids(3);
        else setPoids(1);
    }, [typeDevoir]);

    const handleSave = async () => {
        if (!selectedClasse || !selectedMatiere || !titreDevoir) {
            setMessage("Erreur : Veuillez remplir la classe, la matière et le titre du devoir.");
            return;
        }

        setSaving(true);
        setMessage('');

        // Génération d'un ID unique pour ce devoir
        const devoirId = crypto.randomUUID();
        const notesToSave = [];

        elevesClasse.forEach(eleve => {
            const draft = notesDraft[eleve._id];
            if (draft && draft.note !== undefined && draft.note !== '') {
                notesToSave.push({
                    eleveId: eleve._id,
                    classeId: selectedClasse,
                    matiereId: selectedMatiere,
                    enseignantId: ctx.user?._id || 'admin', 
                    annee: "2024-2025", // En production, utiliser l'année scolaire active du contexte
                    trimestre: trimestre,
                    note: Number(draft.note),
                    sur: Number(surValeur),
                    typeDevoir: typeDevoir,
                    poids: Number(poids),
                    titre: titreDevoir,
                    dateEvaluation: new Date(dateEvaluation),
                    appreciation: draft.appreciation || ''
                });
            }
        });

        if (notesToSave.length === 0) {
            setMessage("Erreur : Veuillez saisir au moins une note.");
            setSaving(false);
            return;
        }

        try {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ devoirId, notes: notesToSave })
            });
            const data = await res.json();
            
            if (data.success) {
                setMessage(`Succès ! ${data.count} notes enregistrées pour ce devoir.`);
                // Reset form optionally
                setNotesDraft({});
                setTitreDevoir('');
            } else {
                setMessage("Erreur : " + data.error);
            }
        } catch (err) {
            setMessage("Erreur serveur : " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!canEdit) return <p>Accès refusé. Réservé aux professeurs.</p>;

    return (
        <div className="notes-entry" style={{ padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <h2 style={{ color: '#1E3A8A', marginBottom: '20px' }}>Saisie d'une Évaluation (Collège)</h2>
            
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Classe</label>
                    <select value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                        <option value="">-- Choisir une classe --</option>
                        {ctx.classes?.map(c => (
                            <option key={c._id} value={c._id}>{c.alias || c.niveau}</option>
                        ))}
                    </select>
                </div>
                
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Matière</label>
                    <select value={selectedMatiere} onChange={e => setSelectedMatiere(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                        <option value="">-- Choisir une matière --</option>
                        {ctx.dynamicSubjects?.map(m => (
                            <option key={m.id} value={m.id}>{m.nom}</option>
                        ))}
                    </select>
                </div>

                <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Trimestre</label>
                    <select value={trimestre} onChange={e => setTrimestre(Number(e.target.value))} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                        <option value={1}>1er Trimestre</option>
                        <option value={2}>2ème Trimestre</option>
                        <option value={3}>3ème Trimestre</option>
                    </select>
                </div>
            </div>

            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: '2', minWidth: '250px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Titre de l'évaluation</label>
                    <input type="text" placeholder="Ex: Interrogation sur le Chapitre 3" value={titreDevoir} onChange={e => setTitreDevoir(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
                <div style={{ flex: '1', minWidth: '120px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Type</label>
                    <select value={typeDevoir} onChange={e => setTypeDevoir(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                        <option value="CC">CC (Contrôle Continu)</option>
                        <option value="DS">DS (Devoir Surveillé)</option>
                        <option value="EX">EX (Examen Blanc)</option>
                    </select>
                </div>
                <div style={{ flex: '1', minWidth: '80px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Poids (Coeff)</label>
                    <input type="number" min="0.5" step="0.5" value={poids} onChange={e => setPoids(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
                <div style={{ flex: '1', minWidth: '80px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Note sur</label>
                    <input type="number" min="1" value={surValeur} onChange={e => setSurValeur(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
                <div style={{ flex: '1', minWidth: '150px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Date</label>
                    <input type="date" value={dateEvaluation} onChange={e => setDateEvaluation(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
            </div>

            {selectedClasse && elevesClasse.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                    <thead>
                        <tr style={{ background: '#1E3A8A', color: 'white' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Élève</th>
                            <th style={{ padding: '12px', width: '150px' }}>Note /{surValeur}</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>Appréciation (optionnelle)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {elevesClasse.map((eleve, index) => (
                            <tr key={eleve._id} style={{ borderBottom: '1px solid #e2e8f0', background: index % 2 === 0 ? '#fff' : '#f8f9fa' }}>
                                <td style={{ padding: '12px', fontWeight: '500' }}>
                                    {eleve.nom} {Array.isArray(eleve.prenoms) ? eleve.prenoms.join(' ') : eleve.prenoms}
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        max={surValeur} 
                                        step="0.25"
                                        placeholder="-"
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                        value={notesDraft[eleve._id]?.note ?? ''}
                                        onChange={e => setNotesDraft(prev => ({
                                            ...prev, 
                                            [eleve._id]: { ...prev[eleve._id], note: e.target.value }
                                        }))}
                                    />
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <input 
                                        type="text" 
                                        placeholder="Bon travail, à l'oral..." 
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                                        value={notesDraft[eleve._id]?.appreciation ?? ''}
                                        onChange={e => setNotesDraft(prev => ({
                                            ...prev, 
                                            [eleve._id]: { ...prev[eleve._id], appreciation: e.target.value }
                                        }))}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {selectedClasse && elevesClasse.length === 0 && (
                <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Aucun élève trouvé dans cette classe.</p>
            )}

            <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ 
                        background: saving ? '#94a3b8' : '#22c55e', 
                        color: 'white', 
                        padding: '12px 24px', 
                        border: 'none', 
                        borderRadius: '6px', 
                        fontWeight: 'bold',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        transition: '0.2s'
                    }}
                >
                    {saving ? 'Enregistrement en cours...' : '✅ Publier les notes de cette évaluation'}
                </button>
                {message && <span style={{ fontWeight: '500', color: message.startsWith('Erreur') ? '#ef4444' : '#10b981' }}>{message}</span>}
            </div>
        </div>
    );
}

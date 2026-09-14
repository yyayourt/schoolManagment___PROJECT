import Subject from '../../../_/models/ai/Subject';
import ReportCard from '../../../_/models/ai/ReportCard';
import Classe from '../../../_/models/ai/Classe';
import Note from '../../../_/models/ai/Note';
import mongoose from 'mongoose';
import crypto from 'crypto'; // For UUID

const subjectDefinitions = [
    { nom: '[Démo] Mathématiques', code: 'D_MATH', couleur: '#e74c3c', dureeDefaut: 55, niveaux: false },
    { nom: '[Démo] Français', code: 'D_FR', couleur: '#3498db', dureeDefaut: 55, niveaux: false },
    { nom: '[Démo] Histoire-Géographie', code: 'D_HG', couleur: '#f39c12', dureeDefaut: 55, niveaux: false },
    { nom: '[Démo] Physique-Chimie', code: 'D_PC', couleur: '#2ecc71', dureeDefaut: 55, niveaux: false },
    { nom: '[Démo] SVT', code: 'D_SVT', couleur: '#1abc9c', dureeDefaut: 55, niveaux: false },
    { nom: '[Démo] Anglais LV1', code: 'D_ANG', couleur: '#9b59b6', dureeDefaut: 55, niveaux: false },
    { nom: '[Démo] Espagnol LV2', code: 'D_ESP', couleur: '#8e44ad', dureeDefaut: 55, niveaux: ['5ème', '4ème', '3ème'] },
    { nom: '[Démo] EPS', code: 'D_EPS', couleur: '#e67e22', dureeDefaut: 110, niveaux: false }
];

export const seedSubjects = async (schoolKey) => {
    const createdSubjects = [];
    for (const def of subjectDefinitions) {
        const sub = await Subject.findOneAndUpdate(
            { code: def.code, schoolKey },
            { $set: { ...def } },
            { upsert: true, new: true }
        );
        createdSubjects.push(sub);
    }
    return createdSubjects;
};

export const getCoefficientsForNiveau = (niveau, subjects) => {
    const coefs = {};
    for (const sub of subjects) {
        if (sub.niveaux && sub.niveaux !== false && !sub.niveaux.some(n => niveau.includes(n))) {
            continue; 
        }
        
        if (sub.code === 'D_MATH' || sub.code === 'D_FR') coefs[sub._id.toString()] = 4;
        else if (sub.code === 'D_HG' || sub.code === 'D_ANG') coefs[sub._id.toString()] = 3;
        else if (sub.code === 'D_PC' || sub.code === 'D_SVT' || sub.code === 'D_ESP') coefs[sub._id.toString()] = 2;
        else coefs[sub._id.toString()] = 1; // EPS
    }
    return coefs;
};

// Generates Note documents for all students in a class
export const generateStudentNotes = async (classe, elevesPopulated, subjects, schoolYear, schoolKey) => {
    const coefs = getCoefficientsForNiveau(classe.niveau, subjects);
    const applicableSubjects = subjects.filter(sub => coefs[sub._id.toString()]);
    
    const trimesters = [1, 2, 3];
    const allNotes = [];

    trimesters.forEach(trim => {
        applicableSubjects.forEach(sub => {
            // Un DS, un CC, un EX par matière et par trimestre
            const devoirs = [
                { type: 'CC', poids: 1, sur: 20, titre: 'Interrogation surprise' },
                { type: 'DS', poids: 2, sur: 20, titre: 'Devoir sur table' },
                { type: 'EX', poids: 3, sur: 20, titre: 'Examen de fin de séquence' }
            ];

            devoirs.forEach(dev => {
                const devoirId = crypto.randomUUID();
                const dateEval = new Date(parseInt(schoolYear.split('-')[0]), 8 + (trim-1)*3, 15);

                elevesPopulated.forEach(eleve => {
                    let baseScore = 12;
                    if (eleve.profileType === 'EXCELLENT') baseScore = 16;
                    else if (eleve.profileType === 'DIFFICULTES') baseScore = 8;
                    
                    const noteVal = Math.max(0, Math.min(20, baseScore + (Math.random() * 4 - 2)));
                    
                    allNotes.push({
                        schoolKey,
                        eleveId: eleve._id,
                        classeId: classe._id,
                        matiereId: sub._id.toString(),
                        enseignantId: classe.professeur[0], // fallback
                        annee: schoolYear,
                        trimestre: trim,
                        devoirId,
                        note: parseFloat(noteVal.toFixed(2)),
                        sur: dev.sur,
                        typeDevoir: dev.type,
                        poids: dev.poids,
                        titre: dev.titre,
                        dateEvaluation: dateEval,
                        appreciation: "Généré par la démo"
                    });
                });
            });
        });
    });

    if (allNotes.length > 0) {
        await Note.insertMany(allNotes);
    }
};

export const generateReportCardsForYear = async (classe, elevesPopulated, yearStr, schoolKey, subjects) => {
    const { computeClassReportFromNotes } = require('../../../../../utils/bulletins');
    
    for (let trim = 1; trim <= 2; trim++) {
        const periodKey = `TRIMESTRE_${trim}`;
        
        const notes = await Note.find({ schoolKey, classeId: classe._id, annee: yearStr, trimestre: trim }).lean();
        if (notes.length === 0) continue;

        const classCoefficients = classe.coefficients || {};
        const report = computeClassReportFromNotes(elevesPopulated, notes, classCoefficients);
        
        const subjMap = {};
        for (const s of subjects) subjMap[s._id.toString()] = s.nom;

        for (const ps of report.perStudent) {
            const general = ps.general;
            
            const subjectsLines = ps.subjects.map(s => {
                const cls = report.classSubjects[s.key] || {};
                return {
                    schoolKey,
                    key: s.key,
                    name: subjMap[s.key] || s.key,
                    average: s.average ? parseFloat(s.average.toFixed(2)) : null,
                    classAverage: cls.average ? parseFloat(cls.average.toFixed(2)) : null,
                    classMin: cls.min ? parseFloat(cls.min.toFixed(2)) : null,
                    classMax: cls.max ? parseFloat(cls.max.toFixed(2)) : null,
                    appreciation: 'Résultats satisfaisants.'
                };
            });

            const rc = new ReportCard({
                schoolKey,
                studentId: ps.studentId,
                classId: classe._id,
                period: periodKey,
                schoolYear: yearStr,
                globalAverage: general ? parseFloat(general.toFixed(2)) : 0,
                classGeneralAverage: report.classGeneral ? parseFloat(report.classGeneral.toFixed(2)) : 0,
                rank: report.rank[ps.studentId] || 1,
                classSize: report.classSize,
                mention: general >= 16 ? "Félicitations" : general >= 14 ? "Bien" : general >= 12 ? "Encouragements" : "Assez bien",
                source: "NoteModel",
                subjects: subjectsLines,
                generalAppreciation: "Bilan trimestriel satisfaisant pour la démo.",
                isClassSummary: false
            });
            await rc.save();
        }
    }
};

export const convertNotesToCompositions = (notes, yearStr) => {
    return {}; // Legacy return, empty for middle school
};

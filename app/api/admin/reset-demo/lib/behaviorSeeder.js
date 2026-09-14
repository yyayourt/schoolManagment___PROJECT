import PointLabel from '../../../_/models/ai/PointLabel';
import PointTransaction from '../../../_/models/ai/PointTransaction';
import Incident from '../../../_/models/ai/Incident';
import CarnetEntry from '../../../_/models/ai/CarnetEntry';

const defaultLabels = [
    { name: '[Démo] Bonne participation', type: 'BONUS', defaultAmount: 1, color: '#2ecc71', icon: '✋' },
    { name: '[Démo] Travail exceptionnel', type: 'BONUS', defaultAmount: 3, color: '#f1c40f', icon: '⭐' },
    { name: '[Démo] Camaraderie / Entraide', type: 'BONUS', defaultAmount: 2, color: '#3498db', icon: '🤝' },
    { name: '[Démo] Bavardage', type: 'MALUS', defaultAmount: -1, color: '#e67e22', icon: '💬' },
    { name: '[Démo] Devoir non fait', type: 'MALUS', defaultAmount: -2, color: '#e74c3c', icon: '❌' },
    { name: '[Démo] Comportement irrespectueux', type: 'MALUS', defaultAmount: -5, color: '#c0392b', icon: '⚠️' }
];

export const seedPointLabels = async (schoolKey) => {
    const createdLabels = [];
    for (const def of defaultLabels) {
        const label = await PointLabel.findOneAndUpdate(
            { name: def.name },
            { $set: { ...def, schoolKey } },
            { upsert: true, new: true }
        );
        createdLabels.push(label);
    }
    return createdLabels;
};

export const generateBehaviorAndAdminForClassYear = async (classe, elevesPopulated, yearStr, schoolKey, teacherId, labels, getRandomDate) => {
    for (const eleve of elevesPopulated) {
        
        // 1. Frais de scolarité (Administration)
        if (!eleve.scolarity_fees_$_checkbox) eleve.scolarity_fees_$_checkbox = {};
        const feeDate = getRandomDate(yearStr).getTime();
        eleve.scolarity_fees_$_checkbox[yearStr] = {
            [feeDate]: [
                { feeId: 'scol', amount: 350, timestamp: feeDate }
            ]
        };

        // 2. Commentaires du professeur principal
        if (!eleve.commentaires) eleve.commentaires = [];
        
        const randComment = Math.random();
        let textComment = "Année satisfaisante dans l'ensemble.";
        if (randComment > 0.8) textComment = "Excellente progression, élève moteur pour la classe.";
        else if (randComment < 0.2) textComment = "Doit fournir plus d'efforts de concentration.";

        eleve.commentaires.push({
            [getRandomDate(yearStr).getTime()]: `[Démo] ${textComment}`
        });

        // 3. Transactions de points (Bonus/Malus)
        const numTransactions = Math.floor(Math.random() * 5); // 0 à 4 événements par an
        for (let i = 0; i < numTransactions; i++) {
            const label = labels[Math.floor(Math.random() * labels.length)];
            
            let comment = '';
            if (Math.random() > 0.8) {
                if (label.type === 'MALUS') comment = "Plusieurs avertissements donnés.";
                if (label.type === 'BONUS') comment = "Très bonne implication aujourd'hui.";
            }

            const transaction = new PointTransaction({
                schoolKey,
                studentId: eleve._id,
                teacherId: teacherId.toString(),
                classId: classe._id,
                amount: label.defaultAmount,
                labelId: label._id,
                comment,
                createdAt: getRandomDate(yearStr)
            });
            await transaction.save();
            
            if (label.type === 'BONUS') {
                if (!eleve.bonus) eleve.bonus = [];
                eleve.bonus.push({
                    [transaction.createdAt.getTime()]: `[Démo] ${label.name}`
                });
            } else {
                if (!eleve.manus) eleve.manus = [];
                eleve.manus.push({
                    [transaction.createdAt.getTime()]: `[Démo] ${label.name}`
                });
            }
        }

        // 4. Génération d'incidents de Vie Scolaire (Collège)
        if (Math.random() > 0.6) {
            const incidentDate = getRandomDate(yearStr);
            const gravites = ['FAIBLE', 'MOYENNE', 'GRAVE'];
            const gravite = gravites[Math.floor(Math.random() * gravites.length)];
            
            let sanctionType = 'AUCUNE';
            let details = '';
            if (gravite === 'MOYENNE') {
                sanctionType = 'HEURE_DE_COLLE';
                details = '1h de retenue le mercredi après-midi';
            } else if (gravite === 'GRAVE') {
                sanctionType = 'AVERTISSEMENT';
                details = 'Avertissement de conduite notifié par la CPE';
            }

            const incident = new Incident({
                schoolKey,
                eleveId: eleve._id,
                rapporteurId: teacherId,
                classeId: classe._id,
                dateIncident: incidentDate,
                description: `[Démo] Incident de discipline en classe de ${classe.niveau}`,
                gravite,
                sanction: {
                    type: sanctionType,
                    details,
                    travailAFaire: sanctionType !== 'AUCUNE' ? 'Exercices de révision à rendre en colle' : '',
                    dateSanction: new Date(incidentDate.getTime() + 86400000 * 2),
                    estSigneParParent: Math.random() > 0.3
                }
            });
            await incident.save();
        }

        // 5. Génération du carnet de correspondance numérique
        if (Math.random() > 0.5) {
            const carnetDate = getRandomDate(yearStr);
            const types = ['OBSERVATION', 'INFORMATION', 'CONVOCATION', 'AUTORISATION'];
            const typeChoice = types[Math.floor(Math.random() * types.length)];

            const carnet = new CarnetEntry({
                schoolKey,
                eleveId: eleve._id,
                auteurId: teacherId,
                auteurRole: 'PROF',
                type: typeChoice,
                titre: `[Démo] ${typeChoice} - Année ${yearStr}`,
                contenu: `Billet d'information à destination des responsables de l'élève pour le suivi en ${classe.niveau}.`,
                luParParent: true,
                dateLecture: carnetDate,
                signatureParent: Math.random() > 0.3,
                dateSignature: carnetDate
            });
            await carnet.save();
        }
    }
};

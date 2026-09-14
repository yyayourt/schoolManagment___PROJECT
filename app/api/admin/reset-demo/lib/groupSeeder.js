export const generateGroupsAndMessages = async (Group, GroupMessage, schoolKey, adminId, teachers, students, getRandomDateInYear, currentYearStr) => {
    // Ne générer des groupes que si on est dans les 2 dernières années pour que ça reste "frais" dans la démo
    const yearParts = currentYearStr.split('-');
    const currentYearNum = parseInt(yearParts[0]);
    if (currentYearNum < 2023) return; // Pas de groupes pour les très vieilles années
    
    const yearStart = new Date(currentYearStr.split('-')[0] + "-09-01T08:00:00Z").getTime();
    
    // Création de 2 groupes
    const prefix = schoolKey.substring(0, 4).toUpperCase();
    const groups = [
        { name: "Association Sportive (AS)", desc: "Pour tous les membres des équipes sportives de l'école.", code: `AS-${currentYearNum}-${prefix}` },
        { name: "Club Théâtre", desc: "Organisation des pièces de théâtre et répétitions.", code: `THEATRE-${currentYearNum}-${prefix}` }
    ];

    const teacherId = teachers.length > 0 ? `user_teacher_${teachers[0]._id.toString()}` : adminId;
    const teacherName = teachers.length > 0 ? `M. ${teachers[0].nom}` : "Direction";

    for (const gData of groups) {
        // Sélectionner quelques membres au hasard
        const members = [
            { userId: adminId, role: 'ADMIN', userType: 'ADMIN' },
            { userId: teacherId, role: 'ADMIN', userType: 'TEACHER' }
        ];

        // Ajouter 3 élèves au groupe
        const studentsInGroup = [];
        for (let i = 0; i < Math.min(3, students.length); i++) {
            const student = students[i];
            const stuClerkId = `user_student_${student._id.toString()}`;
            members.push({ userId: stuClerkId, role: 'MEMBER', userType: 'STUDENT' });
            studentsInGroup.push({ id: stuClerkId, name: student.prenoms[0] });
        }

        const group = await Group.create({
            schoolKey,
            name: gData.name,
            description: gData.desc,
            creatorId: adminId,
            members,
            isPrivate: false,
            invitationCode: gData.code,
            createdAt: new Date(yearStart + 5 * 24 * 60 * 60 * 1000)
        });

        // Générer quelques messages de discussion
        const messagesToInsert = [
            { senderId: adminId, senderName: "Direction", content: `Bienvenue dans le groupe ${gData.name} pour cette nouvelle année !`, daysOffset: 6 },
            { senderId: teacherId, senderName: teacherName, content: "Les inscriptions sont ouvertes, n'hésitez pas à poser vos questions ici.", daysOffset: 7 }
        ];

        if (studentsInGroup.length > 0) {
            messagesToInsert.push({ senderId: studentsInGroup[0].id, senderName: studentsInGroup[0].name, content: "Bonjour, à quelle heure sont les entraînements/répétitions ?", daysOffset: 8 });
            messagesToInsert.push({ senderId: teacherId, senderName: teacherName, content: "Tous les mercredis après-midi à partir de 14h.", daysOffset: 8 });
        }

        for (const msg of messagesToInsert) {
            await GroupMessage.create({
                schoolKey,
                groupId: group._id,
                senderId: msg.senderId,
                senderName: msg.senderName,
                content: msg.content,
                createdAt: new Date(yearStart + msg.daysOffset * 24 * 60 * 60 * 1000)
            });
        }
    }
};

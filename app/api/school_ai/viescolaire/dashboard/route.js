import dbConnect from '../../../lib/dbConnect';
import Incident from '../../../_/models/ai/Incident';
import CarnetEntry from '../../../_/models/ai/CarnetEntry';
import AttendanceEntry from '../../../_/models/ai/AttendanceEntry';
import { NextResponse } from 'next/server';
import { getAuthAndRole } from '../../../../../utils/roles';

export async function GET(request) {
  try {
    const { success, isAdmin, isTeacher } = await getAuthAndRole(request);
    if (!success || (!isAdmin && !isTeacher)) {
      return NextResponse.json({ error: 'Accès non autorisé (Réservé au personnel éducatif)' }, { status: 403 });
    }

    await dbConnect();

    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const schoolKey = cookieStore.get('x-school-key')?.value || 'ecole_st_martin';

    // 1. Incidents récents
    const recentIncidents = await Incident.find({ schoolKey })
      .populate('eleveId', 'nom prenoms current_classe photo')
      .populate('rapporteurId', 'nom prenoms email')
      .sort({ dateIncident: -1 })
      .limit(15)
      .lean();

    // 2. Mots de carnet non signés
    const pendingCarnets = await CarnetEntry.find({ schoolKey, signatureParent: false })
      .populate('eleveId', 'nom prenoms current_classe photo')
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    // 3. Absences/Retards récents avec justificatifs en attente
    const pendingAttendance = await AttendanceEntry.find({
      schoolKey,
      status: { $in: ['ABSENT', 'LATE'] }
    })
      .populate('studentId', 'nom prenoms current_classe photo')
      .sort({ date: -1 })
      .limit(20)
      .lean();

    // 4. Statistiques globales pour les cartes KPIs
    const totalIncidents = await Incident.countDocuments({ schoolKey });
    const pendingJustificationsCount = await AttendanceEntry.countDocuments({
      schoolKey,
      'justification.status': 'PENDING'
    });
    const unexcusedAbsencesCount = await AttendanceEntry.countDocuments({
      schoolKey,
      status: 'ABSENT',
      'justification.status': { $ne: 'ACCEPTED' }
    });
    const pendingCarnetSignaturesCount = await CarnetEntry.countDocuments({
      schoolKey,
      signatureParent: false
    });

    return NextResponse.json({
      stats: {
        totalIncidents,
        pendingJustificationsCount,
        unexcusedAbsencesCount,
        pendingCarnetSignaturesCount
      },
      recentIncidents,
      pendingCarnets,
      pendingAttendance
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors du chargement du tableau de bord Vie Scolaire', details: error.message }, { status: 500 });
  }
}

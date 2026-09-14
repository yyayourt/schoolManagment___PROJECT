import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import Institution from '../../_/models/ai/Institution';
import SchoolSettings from '../../_/models/ai/SchoolSettings';
import Classe from '../../_/models/ai/Classe';
import Eleve from '../../_/models/ai/Eleve';
import Teacher from '../../_/models/ai/Teacher';
import Subject from '../../_/models/ai/Subject';
import Note from '../../_/models/ai/Note';
import Schedule from '../../_/models/ai/Schedule';

const MAX_AGE_HOURS = 48;

/**
 * GET /api/cron/cleanup-sandboxes
 * Purge les écoles bac à sable anonymes (jamais rattachées à un compte) de
 * plus de 48 h. Appel anonyme → le middleware route vers la base sandbox,
 * qui est bien la seule concernée.
 *
 * Protégé par `Authorization: Bearer <CRON_SECRET>` (convention Vercel Cron).
 * Refusé si CRON_SECRET n'est pas configuré : pas de secret par défaut.
 */
export async function GET(request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, error: 'CRON_SECRET non configuré' }, { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
    }

    await dbConnect();

    const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);
    const stale = await Institution.find({
      isReal: false,
      ownerClerkId: null,
      schoolKey: /^sandbox_/,
      createdAt: { $lt: cutoff },
    });

    const purged = [];
    for (const inst of stale) {
      const { schoolKey } = inst;
      const [eleves, enseignants, classes, notes, schedules, matieres] = await Promise.all([
        Eleve.deleteMany({ schoolKey }),
        Teacher.deleteMany({ schoolKey }),
        Classe.deleteMany({ schoolKey }),
        Note.deleteMany({ schoolKey }),
        Schedule.deleteMany({ schoolKey }),
        Subject.deleteMany({ schoolKey }),
      ]);
      await SchoolSettings.deleteOne({ schoolKey });
      await Institution.deleteOne({ schoolKey });
      purged.push({
        schoolKey,
        name: inst.name,
        eleves: eleves.deletedCount,
        enseignants: enseignants.deletedCount,
        classes: classes.deletedCount,
        notes: notes.deletedCount,
        schedules: schedules.deletedCount,
        matieres: matieres.deletedCount,
      });
    }

    return NextResponse.json({ success: true, purged: purged.length, details: purged });
  } catch (err) {
    console.error('❌ Cron cleanup-sandboxes failed:', err);
    return NextResponse.json({ success: false, error: 'Erreur lors du nettoyage', details: err.message }, { status: 500 });
  }
}

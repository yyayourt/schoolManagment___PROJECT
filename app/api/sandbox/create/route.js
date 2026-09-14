import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import dbConnect from '../../lib/dbConnect';
import { isSandboxRequest } from '../../lib/tenant';
import { normaliserConfiguration, genererEcole } from '../../lib/schoolGenerator';

/**
 * POST /api/sandbox/create
 * Crée une école bac à sable personnalisée à partir du formulaire de la landing.
 *
 * Route volontairement publique : l'école est créée dans la base bac à sable
 * sous une clé `sandbox_xxxxxx`, puis activée côté client via cookies. Le
 * middleware route un anonyme vers la sandbox ; un visiteur connecté doit
 * envoyer l'en-tête `x-tenant-mode: sandbox` (fait par SchoolGeneratorForm).
 * Si le visiteur est connecté, il devient propriétaire de l'école (sinon
 * `sync-user` fera le rattachement lors de son inscription).
 */
export async function POST(request) {
  try {
    if (!(await isSandboxRequest())) {
      return NextResponse.json(
        { success: false, error: 'La création de bac à sable n\'est possible que sur le tenant sandbox.' },
        { status: 400 }
      );
    }

    let body;
    try { body = await request.json(); } catch { body = {}; }
    if (!String(body.name || '').trim()) {
      return NextResponse.json({ success: false, error: 'Le nom de l\'école est requis.' }, { status: 400 });
    }

    let config;
    try {
      config = normaliserConfiguration(body);
    } catch (err) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status || 400 });
    }

    let ownerClerkId = null;
    try { ownerClerkId = (await auth())?.userId || null; } catch { /* anonyme */ }

    await dbConnect();

    const schoolKey = `sandbox_${Math.random().toString(36).substring(2, 8)}`;
    const result = await genererEcole(config, { schoolKey, ownerClerkId, isReal: false, createdBy: ownerClerkId || 'user_fake_admin_123' });

    const response = NextResponse.json({ success: true, ...result, message: 'École bac à sable créée avec succès.' });
    const cookie = { path: '/', maxAge: 86400 };
    response.cookies.set('x-school-key', schoolKey, cookie);
    response.cookies.set('is_landing_demo', 'true', cookie);
    response.cookies.set('force_falsy', 'true', cookie);
    response.cookies.set('mock_role', 'admin', cookie);
    return response;
  } catch (err) {
    console.error('❌ Failed to create sandbox:', err);
    return NextResponse.json({ success: false, error: 'Erreur lors de la création du bac à sable', details: err.message }, { status: 500 });
  }
}

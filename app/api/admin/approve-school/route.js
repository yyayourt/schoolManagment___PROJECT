import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import { requireFamilyScope } from '../../lib/familyScope';
import User from '../../_/models/ai/User';
import Institution from '../../_/models/ai/Institution';
import SchoolSettings from '../../_/models/ai/SchoolSettings';

export async function GET(request) {
  try {
    // Action d'administration (super-admin) : refusée à tout non-admin.
    const scope = await requireFamilyScope(request, { adminOnly: true });
    if (scope.error) return scope.error;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const schoolName = searchParams.get('schoolName') || 'Nouvel Établissement';

    if (!userId) {
      return new NextResponse('ID Utilisateur manquant', { status: 400 });
    }

    await dbConnect();

    // 1. Trouver l'utilisateur
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return new NextResponse('Utilisateur non trouvé en base de données', { status: 404 });
    }

    // 2. Générer la clé de production officielle
    const randId = Math.random().toString(36).substring(2, 8);
    const officialSchoolKey = `school_${randId}`;

    // 3. Créer l'Institution en production
    const existingInst = await Institution.findOne({ schoolKey: officialSchoolKey });
    if (!existingInst) {
      const inst = new Institution({
        schoolKey: officialSchoolKey,
        name: schoolName,
        logo: '/school/logo.webp',
        ownerClerkId: userId,
        isReal: true
      });
      await inst.save();
    }

    // 4. Créer les Paramètres par défaut en production
    const existingSettings = await SchoolSettings.findOne({ schoolKey: officialSchoolKey });
    if (!existingSettings) {
      const settings = new SchoolSettings({
        schoolKey: officialSchoolKey,
        feeDefinitions: [
          {
            id: 'scol_cash',
            label: 'Frais Scolaires',
            unit: '€',
            targets: [
              { key: 'standard', label: 'Tarif Général', amount: 120 }
            ]
          }
        ],
        targets: [
          {
            key: 'isInterne',
            options: ['Externe', 'Pensionnaire']
          }
        ],
        homepage: {
          title: schoolName,
          texts: ["Bienvenue sur le portail de votre nouvel établissement scolaire.", "Configurez vos classes et élèves pour démarrer."],
          photo: '/school/classe.webp'
        }
      });
      await settings.save();
    }

    // 5. Mettre à jour l'utilisateur
    user.realSchoolStatus = 'approved';
    user.schoolKey = officialSchoolKey;
    user.role = 'admin'; // L'utilisateur devient l'admin de sa vraie école
    await user.save();

    // Retourner une page HTML élégante de succès
    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Approbation Réussie - ESMP SaaS</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', sans-serif;
            background: #0f172a;
            color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 40px;
            border-radius: 24px;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            max-width: 450px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 {
            font-size: 1.8rem;
            margin: 0 0 10px 0;
            color: #22c55e;
          }
          p {
            color: #94a3b8;
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .details {
            background: rgba(15, 23, 42, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 16px;
            border-radius: 12px;
            text-align: left;
            margin-bottom: 24px;
            font-family: monospace;
            font-size: 0.85rem;
          }
          .details div {
            margin-bottom: 6px;
          }
          .details span {
            color: #f59e0b;
          }
          .btn {
            background: #22c55e;
            color: #0f172a;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: transform 0.2s;
          }
          .btn:hover {
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🎉</div>
          <h1>Établissement Approuvé !</h1>
          <p>La demande d'ouverture de compte de production a été validée avec succès. L'école officielle est maintenant créée et configurée.</p>
          
          <div class="details">
            <div>🔑 Clé Officielle : <span>${officialSchoolKey}</span></div>
            <div>🏫 Établissement : <span>${schoolName}</span></div>
            <div>👤 Propriétaire ID : <span>${userId}</span></div>
          </div>

          <a href="http://localhost:3000" class="btn">Retourner à l'Application</a>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (err) {
    console.error('❌ Failed to approve school:', err);
    return new NextResponse(`Erreur lors de l'approbation : ${err.message}`, { status: 500 });
  }
}

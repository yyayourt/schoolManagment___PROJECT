import { NextResponse } from 'next/server';
import dbConnect from '../../lib/dbConnect';
import { requireFamilyScope } from '../../lib/familyScope';
import User from '../../_/models/ai/User';

export async function GET(request) {
  try {
    // Action d'administration (super-admin) : refusée à tout non-admin.
    const scope = await requireFamilyScope(request, { adminOnly: true });
    if (scope.error) return scope.error;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return new NextResponse('ID Utilisateur manquant', { status: 400 });
    }

    await dbConnect();

    // 1. Trouver l'utilisateur
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      return new NextResponse('Utilisateur non trouvé en base de données', { status: 404 });
    }

    // 2. Mettre à jour l'utilisateur
    user.realSchoolStatus = 'declined';
    await user.save();

    // Retourner une page HTML élégante de refus
    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Demande Déclinée - ESMP SaaS</title>
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
            color: #ef4444;
          }
          p {
            color: #94a3b8;
            font-size: 0.95rem;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .btn {
            background: rgba(255, 255, 255, 0.1);
            color: #f8fafc;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 700;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: background 0.2s;
          }
          .btn:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🛑</div>
          <h1>Demande Déclinée</h1>
          <p>La demande de passage en production pour l'utilisateur <strong>${user.email}</strong> a été refusée.</p>
          <a href="http://localhost:3000" class="btn">Retourner à l'Application</a>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (err) {
    console.error('❌ Failed to decline school:', err);
    return new NextResponse(`Erreur lors du refus : ${err.message}`, { status: 500 });
  }
}

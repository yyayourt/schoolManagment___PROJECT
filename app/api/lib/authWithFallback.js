import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isSandboxRequest } from './tenant'

/**
 * Authentification robuste avec fallback JWT pour Clerk
 * 
 * Cette fonction gère l'authentification de manière robuste en utilisant :
 * 1. La méthode standard auth() de Clerk
 * 2. Un fallback de décodage JWT manuel depuis les headers si auth() échoue
 * 
 * Mode démo (« falsy ») : un visiteur sans compte, ou un compte connecté qui
 * n'est pas super-admin, reçoit l'identité factice `user_fake_admin_123` dont
 * le rôle est ensuite lu dans le cookie `mock_role`. Ce compromis n'est
 * accordé QUE si la requête est routée vers la base bac à sable
 * (cf. `isSandboxRequest`). Sur le tenant production : anonyme → 401,
 * compte connecté → sa vraie identité Clerk (rôle lu en base par getAuthAndRole).
 *
 * @param {Request} request - L'objet Request de NextJS
 * @param {string} context - Contexte pour les logs (ex: "POST /api/schedules")
 * @returns {Object} - { success: boolean, userId: string|null, response: NextResponse|null }
 */
export async function authWithFallback(request, context = 'API') {
  try {
    if (process.env.NEXT_PUBLIC_MODE === 'test') {
      let mockRole = null;
      try {
        const { cookies, headers } = await import('next/headers');
        const cookieStore = await cookies();
        mockRole = cookieStore.get('mock_role')?.value;
        if (!mockRole) {
          const headersList = await headers();
          const authHeader = headersList.get('authorization');
          if (authHeader && authHeader.startsWith('Bearer mock-token-')) {
            mockRole = authHeader.replace('Bearer mock-token-', '');
          }
        }
      } catch (e) {
        // Fallback if called outside Next.js request context
      }
      if (mockRole) {
        console.log(`✅ [TEST MODE] Authentification via mockRole = ${mockRole}`);
        return {
          success: true,
          userId: `mock_user_${mockRole}`,
          response: null
        };
      }
    }
    // Récupérer les headers d'authentification Clerk
    const authStatus = request.headers.get('x-clerk-auth-status')
    const authToken = request.headers.get('x-clerk-auth-token')
    
    let userId = null
    
    // ÉTAPE 1: Essayer d'abord la méthode standard auth()
    try {
      const authResult = await auth()
      userId = authResult.userId
    } catch (authError) {
      // Silence auth error fallback
    }
    
    // ÉTAPE 2: Si auth() échoue, essayer de décoder le token manuellement
    if (!userId && authToken) {
      try {
        const tokenPayload = JSON.parse(atob(authToken.split('.')[1]))
        userId = tokenPayload.sub
      } catch (tokenError) {
        // Silence token error
      }
    }
    
    // ÉTAPE 3: Validation finale
    let forceFalsy = false;
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      forceFalsy = cookieStore.get('force_falsy')?.value === 'true';
    } catch(e) {
      // Ignore if called without proper Next.js request context
    }

    // Bypass strict de sécurité : Un administrateur ne DOIT JAMAIS subir le mode Falsy
    if (userId && authStatus === 'signed-in') {
      const { currentUser } = await import('@clerk/nextjs/server');
      const user = await currentUser();
      const email = user?.primaryEmailAddress?.emailAddress;
      const isAdminEmail = email && process.env.NEXT_PUBLIC_EMAIL_ADMIN && process.env.NEXT_PUBLIC_EMAIL_ADMIN.includes(email);
      
      if (isAdminEmail) {
        forceFalsy = false; // L'Admin écrase le cookie falsy
      } else {
        forceFalsy = true;  // Visiteur non-admin
      }
    }

    // Le mode démo n'existe que sur le tenant bac à sable. En production, un
    // compte connecté garde sa vraie identité et un anonyme est refusé.
    const sandbox = await isSandboxRequest()
    if (!sandbox && userId && authStatus === 'signed-in') {
      forceFalsy = false
    }

    if (forceFalsy || !userId || authStatus !== 'signed-in') {
      if (forceFalsy || !userId) {
        const testModeStrict = process.env.NEXT_PUBLIC_MODE === 'test' && !forceFalsy
        if (testModeStrict || !sandbox) {
          return {
            success: false,
            userId: null,
            response: NextResponse.json(
              { error: 'Non autorisé - Utilisateur non connecté' },
              { status: 401 }
            )
          };
        }

        return {
          success: true,
          userId: 'user_fake_admin_123',
          response: null
        }
      }
      
      return {
        success: false,
        userId: null,
        response: NextResponse.json(
          { error: 'Non autorisé - Utilisateur non connecté' },
          { status: 401 }
        )
      }
    }
    
    return {
      success: true,
      userId,
      response: null
    }
    
  } catch (error) {
    console.error(`❌ Erreur d'authentification ${context}:`, error)
    
    return {
      success: false,
      userId: null,
      response: NextResponse.json(
        { error: 'Erreur serveur lors de l\'authentification' },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware d'authentification pour les routes API
 * 
 * Utilise authWithFallback et retourne directement une réponse d'erreur si l'auth échoue
 * 
 * @param {Request} request - L'objet Request de NextJS
 * @param {string} context - Contexte pour les logs
 * @returns {Promise<string|NextResponse>} - userId si succès, NextResponse si échec
 */
export async function requireAuth(request, context = 'API') {
  const authResult = await authWithFallback(request, context)
  
  if (!authResult.success) {
    return authResult.response
  }
  
  return authResult.userId
}

/**
 * Version simplifiée pour les cas où on veut juste récupérer l'userId
 * sans gestion d'erreur automatique
 * 
 * @param {Request} request - L'objet Request de NextJS
 * @returns {Promise<string|null>} - userId si authentifié, null sinon
 */
export async function getUserId(request) {
  const authResult = await authWithFallback(request, 'getUserId')
  return authResult.userId
}

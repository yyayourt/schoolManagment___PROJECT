import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)'
]);

const isAdminRoute = createRouteMatcher(['/administration(.*)']);

export default clerkMiddleware(async (auth, request) => {
  let mockRole = request.cookies.get('mock_role')?.value;
  if (process.env.NEXT_PUBLIC_MODE === 'test' && !mockRole) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer mock-token-')) {
      mockRole = authHeader.replace('Bearer mock-token-', '');
    }
  }

  // 1. Déterminer la base de données active (Production vs Sandbox)
  let tenantDb = 'prod';
  const schoolKey = request.headers.get('x-school-key') || request.cookies.get('x-school-key')?.value;
  const tenantMode = request.headers.get('x-tenant-mode');

  if (tenantMode === 'sandbox' || (schoolKey && schoolKey.startsWith('sandbox_'))) {
    tenantDb = 'sandbox';
  } else {
    // La production exige un compte Clerk : tout anonyme est forcé en sandbox,
    // quel que soit le cookie x-school-key (l'école courante est ensuite
    // décidée côté serveur, cf. app/api/lib/schoolScope.js).
    const authObj = await auth();
    if (!authObj.userId) {
      tenantDb = 'sandbox';
    }
  }

  // Sécurité absolue : On ignore le mockRole en production (hors mode test)
  const isSandbox = (tenantDb === 'sandbox');
  const isTestMode = (process.env.NEXT_PUBLIC_MODE === 'test');
  if (!isTestMode && !isSandbox) {
    mockRole = undefined;
  }

  // 2. Gestion des redirections de sécurité en mode Test ou Sandbox
  if (mockRole) {
    if (isAdminRoute(request) && mockRole !== 'admin') {
      const url = new URL('/', request.url);
      return NextResponse.redirect(url);
    }
  }

  // Redirection des utilisateurs non connectés sur les routes d'administration
  if (!isPublicRoute(request)) {
    const authObj = await auth();
    if (!authObj.userId && !mockRole) {
      if (isAdminRoute(request)) {
        const signInUrl = new URL('/sign-in', request.url);
        signInUrl.searchParams.set('redirect_url', request.url);
        return NextResponse.redirect(signInUrl);
      }
    }
  }

  // 3. Injecter les en-têtes et poursuivre la requête
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-db', tenantDb);
  if (tenantDb === 'sandbox') {
    requestHeaders.set('x-sample-mode', 'true');
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { TENANT_CACHE_COOKIE, readTenantCache, tenantCacheOptions, tenantCacheValue } from './app/api/lib/tenantCache';

/**
 * École rattachée à un compte Clerk, sans requête Mongo :
 *   1. claims de session (`metadata.schoolKey`, si le jeton Clerk expose public_metadata),
 *   2. cookie cache httpOnly lié au compte (1 h),
 *   3. appel Clerk backend (`publicMetadata.schoolKey`), puis mise en cache.
 * Renvoie { key, cacheToSet } — `key` vaut '' si le compte n'a pas d'école.
 */
async function accountSchoolKey(authObj, request) {
  const { userId, sessionClaims } = authObj;
  const fromClaims = sessionClaims?.metadata?.schoolKey || sessionClaims?.publicMetadata?.schoolKey;
  if (typeof fromClaims === 'string') return { key: fromClaims, cacheToSet: null };

  const cached = readTenantCache(request.cookies.get(TENANT_CACHE_COOKIE)?.value, userId);
  if (cached !== null) return { key: cached, cacheToSet: null };

  let key = '';
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    key = typeof user?.publicMetadata?.schoolKey === 'string' ? user.publicMetadata.schoolKey : '';
  } catch (e) {
    // Clerk indisponible : on ne met pas en cache, on retentera à la prochaine requête
    return { key: '', cacheToSet: null };
  }
  return { key, cacheToSet: tenantCacheValue(userId, key) };
}

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
  let accountKey = null;   // école rattachée au compte connecté (sandbox_* → base sandbox)
  let cacheToSet = null;
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
    } else {
      // Compte connecté : son école (Clerk publicMetadata) décide du tenant,
      // même sans cookie x-school-key côté client.
      const resolved = await accountSchoolKey(authObj, request);
      accountKey = resolved.key;
      cacheToSet = resolved.cacheToSet;
      if (accountKey.startsWith('sandbox_')) {
        tenantDb = 'sandbox';
      }
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
  // École du compte, transmise au serveur (jamais forgeable : réécrite ici).
  requestHeaders.set('x-account-school-key', accountKey || '');

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  if (cacheToSet !== null) {
    response.cookies.set(TENANT_CACHE_COOKIE, cacheToSet, tenantCacheOptions());
  }
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
/**
 * Cache court (cookie httpOnly) de l'école rattachée à un compte Clerk, lu par
 * `middleware.js` pour router un compte connecté vers la bonne base sans
 * requête Mongo. Fichier volontairement sans dépendance : il s'exécute dans le
 * middleware (runtime edge).
 *
 * Source de vérité : `publicMetadata.schoolKey` sur l'utilisateur Clerk
 * (écrit par `sync-user` et `approve-school`). Le cookie n'est qu'un cache :
 *   - lié au `userId` (un autre compte sur le même navigateur ne l'hérite pas),
 *   - durée de vie courte (1 h), ce qui borne le délai de bascule après une
 *     approbation d'école réelle.
 * Un cookie forgé ne peut au pire que router l'utilisateur vers la sandbox,
 * ce que l'en-tête `x-tenant-mode: sandbox` autorise déjà.
 */

export const TENANT_CACHE_COOKIE = 'tenant_school_cache'
export const TENANT_CACHE_MAX_AGE = 60 * 60 // 1 h

const KEY_RE = /^[a-z0-9_-]{0,64}$/i

/** Renvoie la clé mise en cache pour ce compte, `''` si « aucune école », `null` si absent/invalide. */
export function readTenantCache(cookieValue, userId) {
  if (!cookieValue || !userId) return null
  const sep = cookieValue.indexOf(':')
  if (sep < 0) return null
  const cachedUser = cookieValue.slice(0, sep)
  const key = cookieValue.slice(sep + 1)
  if (cachedUser !== userId || !KEY_RE.test(key)) return null
  return key
}

export function tenantCacheOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TENANT_CACHE_MAX_AGE,
  }
}

export function tenantCacheValue(userId, schoolKey) {
  return `${userId}:${schoolKey || ''}`
}

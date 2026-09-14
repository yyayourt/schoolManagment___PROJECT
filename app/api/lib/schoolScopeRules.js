/**
 * Règles PURES de cloisonnement multi-tenant (aucune dépendance Next/Clerk/Mongo),
 * pour être testables unitairement (`npm run test:unit`).
 *
 *   - `decideTenant`    : quelle base (`prod` | `sandbox`) — utilisée par `middleware.js`.
 *   - `decideSchoolKey` : quelle école (filtre `schoolKey`) — utilisée par `schoolScope.js`.
 */

export const SANDBOX_DEFAULT_KEY = 'demo_master'
export const PROD_DEFAULT_KEY = 'ecole_st_martin'
export const FAKE_ADMIN_ID = 'user_fake_admin_123'

export const SCHOOL_KEY_RE = /^[a-z0-9_-]{1,64}$/i

export const isSandboxKey = (key) => typeof key === 'string' && key.startsWith('sandbox_')
export const isValidSchoolKey = (key) => typeof key === 'string' && SCHOOL_KEY_RE.test(key)
export const isDemoIdentity = (userId) =>
  !userId || userId === FAKE_ADMIN_ID || String(userId).startsWith('mock_user_')

/**
 * Base ciblée par une requête.
 *
 * @param {object} p
 * @param {string|null} p.tenantModeHeader  en-tête `x-tenant-mode` envoyé par le client
 * @param {string|null} p.requestedKey      cookie/en-tête `x-school-key` envoyé par le client
 * @param {string|null} p.userId            compte Clerk (null si anonyme)
 * @param {string}      p.accountKey        école rattachée au compte ('' si aucune)
 * @returns {'prod'|'sandbox'}
 */
export function decideTenant({ tenantModeHeader, requestedKey, userId, accountKey }) {
  if (tenantModeHeader === 'sandbox' || isSandboxKey(requestedKey)) return 'sandbox'
  if (!userId) return 'sandbox' // la production exige un compte
  if (isSandboxKey(accountKey)) return 'sandbox'
  return 'prod'
}

/**
 * École courante côté serveur.
 *
 * @param {object} p
 * @param {boolean}     p.testMode      NEXT_PUBLIC_MODE === 'test'
 * @param {boolean}     p.sandbox       requête routée vers la base sandbox
 * @param {string|null} p.requestedKey  cookie/en-tête `x-school-key` (choix du client)
 * @param {string}      p.accountKey    école du compte transmise par le middleware ('' si aucune)
 * @param {string|null} p.userId        identité résolue par l'authentification
 * @param {string|null} p.dbSchoolKey   `User.schoolKey` en production ('' si absent, null si pas de User)
 * @param {boolean}     p.isSuperAdmin  e-mail dans NEXT_PUBLIC_EMAIL_ADMIN
 * @returns {string}
 */
export function decideSchoolKey({ testMode, sandbox, requestedKey, accountKey, userId, dbSchoolKey, isSuperAdmin }) {
  const requested = isValidSchoolKey(requestedKey) ? requestedKey : null
  const account = isValidSchoolKey(accountKey) ? accountKey : null

  if (testMode) return requested || PROD_DEFAULT_KEY
  if (sandbox) return requested || account || SANDBOX_DEFAULT_KEY

  // --- Production : le compte fait foi, jamais le client ---
  if (isDemoIdentity(userId)) return PROD_DEFAULT_KEY
  const own = dbSchoolKey || PROD_DEFAULT_KEY
  if (!requested || requested === own) return own
  return isSuperAdmin ? requested : own
}

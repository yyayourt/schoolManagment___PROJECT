import { auth } from '@clerk/nextjs/server'
import { cookies, headers } from 'next/headers'
import User from '../_/models/ai/User'
import dbConnect from './dbConnect'
import { isSandboxRequest } from './tenant'
import { decideSchoolKey, isDemoIdentity, isValidSchoolKey, SANDBOX_DEFAULT_KEY, PROD_DEFAULT_KEY } from './schoolScopeRules'

export { SANDBOX_DEFAULT_KEY, PROD_DEFAULT_KEY }

/** École du compte connecté, posée par le middleware (non forgeable). */
async function accountSchoolKey() {
  try {
    const headersList = await headers()
    const key = headersList.get('x-account-school-key') || ''
    return isValidSchoolKey(key) ? key : ''
  } catch (e) {
    return ''
  }
}

/** Choix explicite du client : cookie puis en-tête `x-school-key`. */
async function requestedSchoolKey() {
  let key = null
  try {
    const cookieStore = await cookies()
    key = cookieStore.get('x-school-key')?.value || null
  } catch (e) { /* hors contexte requête */ }
  if (!key) {
    try {
      const headersList = await headers()
      key = headersList.get('x-school-key') || null
    } catch (e) { /* idem */ }
  }
  return isValidSchoolKey(key) ? key : null
}

async function isSuperAdminEmail() {
  try {
    const { currentUser } = await import('@clerk/nextjs/server')
    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress
    const admins = process.env.NEXT_PUBLIC_EMAIL_ADMIN?.split(' ') || []
    return Boolean(email && admins.includes(email))
  } catch (e) {
    return false
  }
}

/**
 * Décide de l'école courante côté serveur. SEULE source de vérité pour le
 * filtre `schoolKey` des routes API. La règle elle-même vit dans
 * `schoolScopeRules.js` (pure, couverte par `npm run test:unit`) ; ce fichier
 * ne fait que collecter ses entrées, paresseusement pour les plus coûteuses.
 *
 * - Tenant bac à sable / mode test : le cookie (ou l'en-tête) `x-school-key`
 *   fait foi — c'est la démo, l'utilisateur choisit son école ; à défaut,
 *   l'école sandbox rattachée au compte (en-tête `x-account-school-key` posé
 *   par le middleware). Défaut : `demo_master` en sandbox, `ecole_st_martin`
 *   en mode test.
 * - Tenant production : la clé du document `User` du compte Clerk fait foi ;
 *   le cookie est IGNORÉ, sauf pour le super-admin (NEXT_PUBLIC_EMAIL_ADMIN)
 *   qui peut ainsi administrer plusieurs écoles. Défaut : `ecole_st_martin`.
 *
 * @param {{ userId?: string|null, isSuperAdmin?: boolean, dbSchoolKey?: string|null }} [hint]
 *   Informations déjà connues (évite une requête Mongo / un appel Clerk).
 *   `dbSchoolKey` : `null` si inconnu, `''` si le User n'a pas de clé.
 */
export async function resolveSchoolKey(hint = {}) {
  const testMode = process.env.NEXT_PUBLIC_MODE === 'test'
  const requestedKey = await requestedSchoolKey()
  const sandbox = testMode ? false : await isSandboxRequest()

  if (testMode || sandbox) {
    const accountKey = sandbox ? await accountSchoolKey() : ''
    return decideSchoolKey({ testMode, sandbox, requestedKey, accountKey })
  }

  // --- Production ---
  let userId = hint.userId
  if (userId === undefined) {
    try { userId = (await auth())?.userId || null } catch (e) { userId = null }
  }
  if (isDemoIdentity(userId)) {
    return decideSchoolKey({ testMode, sandbox, requestedKey, accountKey: '', userId: null })
  }

  let dbSchoolKey = hint.dbSchoolKey
  if (dbSchoolKey === undefined || dbSchoolKey === null) {
    await dbConnect() // idempotent : certaines routes résolvent l'école avant de se connecter
    const user = await User.findOne({ clerkId: userId }).select('schoolKey').lean()
    dbSchoolKey = user?.schoolKey || ''
  }

  // L'appel Clerk (e-mail super-admin) n'est fait que si le client demande une autre école.
  const own = dbSchoolKey || PROD_DEFAULT_KEY
  const needsSuperAdmin = Boolean(requestedKey) && requestedKey !== own
  let isSuperAdmin = false
  if (needsSuperAdmin) {
    isSuperAdmin = hint.isSuperAdmin !== undefined ? hint.isSuperAdmin : await isSuperAdminEmail()
  }

  return decideSchoolKey({ testMode, sandbox, requestedKey, accountKey: '', userId, dbSchoolKey, isSuperAdmin })
}

import { auth } from '@clerk/nextjs/server'
import { cookies, headers } from 'next/headers'
import User from '../_/models/ai/User'
import dbConnect from './dbConnect'
import { isSandboxRequest } from './tenant'

/** École de démo partagée (base bac à sable). */
export const SANDBOX_DEFAULT_KEY = 'demo_master'
/** École historique (base de production). */
export const PROD_DEFAULT_KEY = 'ecole_st_martin'

const SCHOOL_KEY_RE = /^[a-z0-9_-]{1,64}$/i

/** École du compte connecté, posée par le middleware (non forgeable). */
async function accountSchoolKey() {
  try {
    const headersList = await headers()
    const key = headersList.get('x-account-school-key') || ''
    return SCHOOL_KEY_RE.test(key) ? key : ''
  } catch (e) {
    return ''
  }
}

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
  return key && SCHOOL_KEY_RE.test(key) ? key : null
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
 * filtre `schoolKey` des routes API.
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
  const requested = await requestedSchoolKey()

  if (process.env.NEXT_PUBLIC_MODE === 'test') return requested || PROD_DEFAULT_KEY
  if (await isSandboxRequest()) {
    // Choix explicite du visiteur (démo), sinon l'école sandbox rattachée au
    // compte (transmise par le middleware), sinon la démo partagée.
    return requested || (await accountSchoolKey()) || SANDBOX_DEFAULT_KEY
  }

  // --- Production ---
  let userId = hint.userId
  if (userId === undefined) {
    try { userId = (await auth())?.userId || null } catch (e) { userId = null }
  }
  if (!userId || userId === 'user_fake_admin_123' || String(userId).startsWith('mock_user_')) {
    return PROD_DEFAULT_KEY
  }

  let own = hint.dbSchoolKey
  if (own === undefined || own === null) {
    await dbConnect() // idempotent : certaines routes résolvent l'école avant de se connecter
    const user = await User.findOne({ clerkId: userId }).select('schoolKey').lean()
    own = user?.schoolKey || ''
  }
  own = own || PROD_DEFAULT_KEY

  if (!requested || requested === own) return own

  const superAdmin = hint.isSuperAdmin !== undefined ? hint.isSuperAdmin : await isSuperAdminEmail()
  return superAdmin ? requested : own
}

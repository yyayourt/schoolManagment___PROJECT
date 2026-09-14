import { NextResponse } from 'next/server'
import { getAuthAndRole } from '../../../utils/roles'
import User from '../_/models/ai/User'

/**
 * Résout les élèves qu'un utilisateur a le droit de consulter.
 *
 * - admin / prof : aucune restriction (`allowedStudentIds` vaut null).
 * - parent : ses `childrenRefs`.
 * - eleve  : son propre `eleveRef`.
 *
 * Cas particulier « bac à sable » : un compte parent/élève de démo n'a aucun
 * rattachement en base (cf. fetchUserWithRefs, qui fabrique une fratrie de
 * démo côté client). On retourne alors null pour ne pas casser la démo — le
 * même compromis que le reste de l'application en mode sandbox.
 */
export async function resolveFamilyScope({ userId, role, isAdmin, isTeacher }) {
  if (isAdmin || isTeacher) return { allowedStudentIds: null, isStaff: true }
  if (role !== 'parent' && role !== 'eleve') return { allowedStudentIds: [], isStaff: false }

  const user = await User.findOne({ clerkId: userId }).select('roleData.childrenRefs roleData.eleveRef')
  const ids =
    role === 'parent'
      ? (user?.roleData?.childrenRefs || [])
      : (user?.roleData?.eleveRef ? [user.roleData.eleveRef] : [])

  if (ids.length === 0) return { allowedStudentIds: null, isStaff: false, sandbox: true }
  return { allowedStudentIds: ids.map(String), isStaff: false }
}

/**
 * Authentifie puis résout le périmètre famille en une passe.
 * Renvoie soit `{ error: NextResponse }`, soit le périmètre exploitable.
 *
 * @param {Request} request
 * @param {{ staffOnly?: boolean, adminOnly?: boolean }} options
 *   - staffOnly : refuse les familles (403).
 *   - adminOnly : refuse tout sauf un administrateur (403), y compris les profs.
 */
export async function requireFamilyScope(request, { staffOnly = false, adminOnly = false } = {}) {
  const auth = await getAuthAndRole(request)
  if (!auth.success) {
    return { error: NextResponse.json({ success: false, error: 'Accès non autorisé' }, { status: 401 }) }
  }

  const scope = await resolveFamilyScope(auth)

  if (adminOnly && !auth.isAdmin) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Accès non autorisé (Réservé aux administrateurs)' },
        { status: 403 }
      ),
    }
  }

  if (staffOnly && !scope.isStaff) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Accès non autorisé (Réservé au personnel éducatif)' },
        { status: 403 }
      ),
    }
  }

  return { auth, ...scope }
}

/** `true` si le périmètre autorise la consultation de cet élève. */
export function canAccessStudent(scope, eleveId) {
  if (!scope.allowedStudentIds) return true
  return scope.allowedStudentIds.includes(String(eleveId))
}

/** Réponse 403 standard sur un élève hors périmètre. */
export function forbiddenStudent() {
  return NextResponse.json({ success: false, error: 'Accès non autorisé à cet élève' }, { status: 403 })
}

/**
 * Restreint une liste d'ids d'élèves (typiquement ceux d'une classe) au
 * périmètre autorisé. Une famille qui interroge une classe entière ne
 * reçoit donc que ses propres enfants.
 */
export function narrowToScope(scope, eleveIds) {
  if (!scope.allowedStudentIds) return eleveIds
  return eleveIds.filter((id) => scope.allowedStudentIds.includes(String(id)))
}

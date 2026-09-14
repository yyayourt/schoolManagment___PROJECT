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

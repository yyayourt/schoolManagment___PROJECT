// Helpers client pour les espaces famille (parent / élève) et la config d'accès.

// Récupère l'utilisateur courant (avec roleData peuplé : childrenRefs / eleveRef).
// En mode Bac à Sable (sandbox), si l'utilisateur n'a pas encore de lien en DB,
// on récupère automatiquement les élèves de démo pour permettre une visualisation complète.
export async function fetchUserWithRefs(clerkId) {
  let user = null;
  if (clerkId) {
    try {
      const res = await fetch(`/api/users/${clerkId}`);
      if (res.ok) user = await res.json();
    } catch (_) { /* ignore */ }
  }

  const role = user?.role || 'parent';
  const hasKids = Array.isArray(user?.roleData?.childrenRefs) && user.roleData.childrenRefs.length > 0;
  const hasEleve = !!user?.roleData?.eleveRef;

  // Si l'utilisateur n'a pas de données ou manque de référence pour son rôle (mode Sandbox sans DB)
  if (!user || (role === 'parent' && !hasKids) || (role === 'eleve' && !hasEleve)) {
    try {
      const resEleves = await fetch('/api/school_ai/eleves');
      if (resEleves.ok) {
        const allEleves = await resEleves.json();
        if (Array.isArray(allEleves) && allEleves.length > 0) {
          // Fratrie de démo (2 enfants) pour un suivi réaliste
          const demoChildren = allEleves.slice(0, 2);
          const demoEleve = allEleves[0];
          return {
            ...user,
            role: role,
            firstName: user?.firstName || (role === 'parent' ? 'Parent' : 'Élève'),
            lastName: user?.lastName || 'Démo',
            roleData: {
              ...(user?.roleData || {}),
              childrenRefs: hasKids ? user.roleData.childrenRefs.slice(0, 2) : demoChildren,
              eleveRef: hasEleve ? user.roleData.eleveRef : demoEleve,
            }
          };
        }
      }
    } catch (_) { /* ignore */ }
  }

  // Si des enfants sont trouvés mais en trop grand nombre (ex: seed démo générique parent@mail.com sur tous les élèves)
  if (user && role === 'parent' && hasKids && user.roleData.childrenRefs.length > 3) {
    user = {
      ...user,
      roleData: {
        ...user.roleData,
        childrenRefs: user.roleData.childrenRefs.slice(0, 2)
      }
    };
  }

  return user;
}

// Configure les clés de correspondance d'un élève (staff). Renvoie l'état à jour.
export async function updateStudentAccount(studentId, payload) {
  const res = await fetch(`/api/students/${studentId}/account`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Erreur lors de la configuration');
  return data.data;
}

// "Jean-Pierre Dupont" depuis un doc élève (prenoms peut être un tableau).
export function studentFullName(eleve) {
  if (!eleve) return '';
  const prenoms = Array.isArray(eleve.prenoms) ? eleve.prenoms.join(' ') : (eleve.prenoms || '');
  return `${eleve.nom || ''} ${prenoms}`.trim();
}

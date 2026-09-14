import { headers } from 'next/headers'

/**
 * Indique si la requête courante est routée vers la base BAC À SABLE.
 *
 * La décision est prise par `middleware.js`, qui réécrit systématiquement
 * l'en-tête `x-tenant-db` (un client ne peut donc pas le forger) :
 *   - anonyme                          → sandbox (sauf cookie x-school-key=ecole_st_martin)
 *   - x-tenant-mode: sandbox / clé sandbox_* → sandbox
 *   - connecté via Clerk                → prod
 *
 * C'est LE discriminant démo / production côté serveur : tout compromis
 * d'authentification réservé à la démo (compte factice, mock_role…) doit
 * être conditionné par cette fonction. Le mode test automatisé
 * (NEXT_PUBLIC_MODE=test) reste un cas à part, géré séparément.
 */
export async function isSandboxRequest() {
  try {
    const headersList = await headers()
    return headersList.get('x-tenant-db') === 'sandbox'
  } catch (e) {
    // Hors contexte de requête Next.js : jamais considéré comme démo.
    return false
  }
}

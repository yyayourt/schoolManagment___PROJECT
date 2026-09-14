import { NextResponse } from 'next/server';
import dbConnect from './dbConnect';
import { authWithFallback } from './authWithFallback';
import { checkRole, Roles } from '../../../utils/roles';
import { resolveSchoolKey } from './schoolScope';

/**
 * HOF factorisant le prologue d'authentification répété dans les routes API.
 *
 * Reproduit exactement le comportement inline :
 *   1. authWithFallback (avec son mode sample « MODE FALSY ») ; renvoie la
 *      réponse d'erreur (401/500) si l'auth échoue.
 *   2. vérification de rôle optionnelle → 403 sinon.
 *   3. connexion DB optionnelle (dbConnect).
 * puis appelle le handler avec le contexte enrichi.
 *
 * @param {(request: Request, ctx: object) => Promise<Response>} handler
 *   ctx = { ...ctxNext, userId, isAdmin, isTeacher, schoolKey } où ctxNext est l'objet
 *   passé par Next.js (contient `params` pour les routes dynamiques [id]).
 * @param {object} [options]
 * @param {string}  [options.context='API'] - libellé de log passé à authWithFallback.
 * @param {string}  [options.role]    - rôle requis (Roles.ADMIN) → 403 sinon.
 * @param {boolean} [options.anyRole] - exige admin OU prof → 403 sinon.
 * @param {object}  [options.denied]  - corps JSON du 403 (défaut { error: 'Accès refusé' }).
 * @param {boolean} [options.db=true] - si false, n'appelle pas dbConnect().
 */
export function withAuth(handler, options = {}) {
  const { context = 'API', role, anyRole, denied = { error: 'Accès refusé' }, db = true } = options;
  return async (request, ctx = {}) => {
    const authResult = await authWithFallback(request, context);
    if (!authResult.success) return authResult.response;
    const userId = authResult.userId;

    let isAdmin;
    let isTeacher;
    if (role || anyRole) {
      isAdmin = await checkRole(Roles.ADMIN, request);
      isTeacher = await checkRole(Roles.TEACHER, request);
      if (role === Roles.ADMIN && !isAdmin) return NextResponse.json(denied, { status: 403 });
      if (anyRole && !isAdmin && !isTeacher) return NextResponse.json(denied, { status: 403 });
    }

    if (db) await dbConnect();
    const schoolKey = await resolveSchoolKey({ userId });
    return handler(request, { ...ctx, userId, isAdmin, isTeacher, schoolKey });
  };
}

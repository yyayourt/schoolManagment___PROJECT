import { auth } from '@clerk/nextjs/server';
import { cookies, headers } from 'next/headers';
import dbConnect from '../app/api/lib/dbConnect';
import User from '../app/api/_/models/ai/User';
import { authWithFallback } from '../app/api/lib/authWithFallback';

export const Roles = {
    ADMIN: 'admin',
    TEACHER: 'prof', // Harmonisé avec le reste de l'application (prof)
};

/**
 * Checks if the current authenticated user has the specified role.
 * @param {string} role - The role to check against (e.g. 'admin', 'prof').
 * @param {Request} [request] - Optional request for robust auth
 * @returns {Promise<boolean>} True if the user has the role, false otherwise.
 */
export const checkRole = async (role, request = null) => {
    try {
        if (process.env.NEXT_PUBLIC_MODE === 'test') {
            const cookieStore = await cookies();
            let mockRole = cookieStore.get('mock_role')?.value;
            if (!mockRole) {
                const headersList = await headers();
                const authHeader = headersList.get('authorization');
                if (authHeader && authHeader.startsWith('Bearer mock-token-')) {
                    mockRole = authHeader.replace('Bearer mock-token-', '');
                }
            }
            if (mockRole) {
                return mockRole === role;
            }
        }

        let userId = null;
        let sessionClaims = null;

        if (request) {
            // Utiliser la méthode robuste si la requête est fournie
            const authResult = await authWithFallback(request, 'checkRole');
            if (authResult.success) {
                userId = authResult.userId;
                // Note: authWithFallback doesn't return sessionClaims in its current form, 
                // but we can fetch them from Clerk if needed or fallback to DB.
            }
        } else {
            // Fallback sur la méthode standard
            const authData = await auth();
            userId = authData.userId;
            sessionClaims = authData.sessionClaims;
        }

        // Mode Démo / Falsy
        if (userId === 'user_fake_admin_123') {
            const cookieStore = await cookies();
            const mockRole = cookieStore.get('mock_role')?.value || 'admin';
            console.log(`🔐 [checkRole] Mode Démo détecté pour user_fake_admin_123 -> mockRole: ${mockRole}`);
            return mockRole === role;
        }

        // 1. Vérification par email Admin (NEXT_PUBLIC_EMAIL_ADMIN)
        try {
            const { currentUser } = await import('@clerk/nextjs/server');
            const clerkUser = await currentUser();
            const email = clerkUser?.primaryEmailAddress?.emailAddress;
            const adminEmails = process.env.NEXT_PUBLIC_EMAIL_ADMIN?.split(' ') || [];
            if (email && adminEmails.includes(email)) {
                if (role === Roles.ADMIN) {
                    return true;
                }
            }
        } catch (e) {
            // Silence if currentUser is unavailable
        }

        // 2. Tenter via sessionClaims (si disponible)
        const userRole = sessionClaims?.metadata?.role || sessionClaims?.publicMetadata?.role;
        if (userRole) {
            return userRole === role;
        }

        // 3. Fallback DB : Plus lent mais fiable
        await dbConnect();
        const mongoUser = await User.findOne({ clerkId: userId }).select('role');
        if (mongoUser) {
            return mongoUser.role === role;
        }

        return false;
    } catch (error) {
        console.error('Error in checkRole:', error);
        return false;
    }
};
/**
 * Obtient l'userId et tous les rôles de l'utilisateur en UN SEUL APPEL OPTIMISÉ.
 * Évite de multiplier les requêtes serveur et les appels HTTP vers Clerk.
 * 
 * @param {Request} request 
 * @returns {Promise<{ success: boolean, userId: string|null, role: string, isAdmin: boolean, isTeacher: boolean }>}
 */
export const getAuthAndRole = async (request) => {
    try {
        const authResult = await authWithFallback(request, 'getAuthAndRole');
        if (!authResult.success || !authResult.userId) {
            return { success: false, userId: null, role: 'public', isAdmin: false, isTeacher: false };
        }

        const userId = authResult.userId;

        // Mode Démo / Falsy
        if (userId === 'user_fake_admin_123') {
            const cookieStore = await cookies();
            const mockRole = cookieStore.get('mock_role')?.value || 'admin';
            return {
                success: true,
                userId,
                role: mockRole,
                isAdmin: mockRole === Roles.ADMIN,
                isTeacher: mockRole === Roles.TEACHER
            };
        }

        // 1. Vérification par email Admin (NEXT_PUBLIC_EMAIL_ADMIN)
        try {
            const { currentUser } = await import('@clerk/nextjs/server');
            const clerkUser = await currentUser();
            const email = clerkUser?.primaryEmailAddress?.emailAddress;
            const adminEmails = process.env.NEXT_PUBLIC_EMAIL_ADMIN?.split(' ') || [];
            if (email && adminEmails.includes(email)) {
                return { success: true, userId, role: Roles.ADMIN, isAdmin: true, isTeacher: false };
            }
        } catch (e) {
            // Silence if currentUser is unavailable
        }

        // 2. Fallback DB : Un seul appel findOne
        await dbConnect();
        const mongoUser = await User.findOne({ clerkId: userId }).select('role');
        const userRole = mongoUser?.role || 'public';

        return {
            success: true,
            userId,
            role: userRole,
            isAdmin: userRole === Roles.ADMIN,
            isTeacher: userRole === Roles.TEACHER
        };
    } catch (error) {
        console.error('Error in getAuthAndRole:', error);
        return { success: false, userId: null, role: 'public', isAdmin: false, isTeacher: false };
    }
};

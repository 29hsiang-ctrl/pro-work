import { useAuth } from '../context/AuthContext';

export function usePermission() {
    const { user, ROLES } = useAuth();
    const roleConfig = ROLES[user?.role] ?? { pages: [], readonly: false };

    return {
        canAccess: (page) => roleConfig.pages.includes(page),
        isReadOnly: roleConfig.readonly ?? false,
        role: user?.role ?? null,
        user,
    };
}

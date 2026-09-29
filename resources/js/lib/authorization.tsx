import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import type { PageProps } from '@/types';
import { hasAnyPermission } from '@/lib/utils';

/**
 * Frontend authorization primitives — the last link in the chain, never the
 * lock itself:
 *
 *   User permissions (shared `auth.user.permissions`, role-carried or direct)
 *     → route protection (backend refuses with 403 → Error page)
 *     → page access (menus hide what the backend would refuse)
 *     → component/action visibility (this file: buttons, sections, rows)
 *
 * Every helper below mirrors a backend gate. If a control renders, the
 * request can still be refused server-side; if a control hides, the request
 * would have been refused. Neither direction leaks data.
 */

function permissionsOf(user: PageProps['auth']['user']): string[] {
    return user?.permissions ?? [];
}

/** True when the user holds the permission (or any of them). */
export function useCan(permission: string | string[]): boolean {
    const { auth } = usePage<PageProps>().props;
    const needed = Array.isArray(permission) ? permission : [permission];
    return hasAnyPermission(permissionsOf(auth.user), needed);
}

/** True only when the user holds every listed permission. */
export function useCanAll(permissions: string[]): boolean {
    const { auth } = usePage<PageProps>().props;
    const held = permissionsOf(auth.user);
    return permissions.every((p) => held.includes(p));
}

/** Firm admins (and super admins) bypass module scoping as accountable owners. */
export function useIsFirmAdmin(): boolean {
    const { auth } = usePage<PageProps>().props;
    return auth.user?.roles?.includes('firm_admin') || auth.user?.roles?.includes('super_admin') || false;
}

/**
 * Render `children` only when permitted; otherwise `fallback` (default:
 * nothing). Prefer hiding over disabling: a disabled control advertises a
 * capability the user must never exercise.
 */
export function Can({
    permission,
    fallback = null,
    children,
}: {
    permission: string | string[];
    fallback?: ReactNode;
    children: ReactNode;
}) {
    return useCan(permission) ? <>{children}</> : <>{fallback}</>;
}

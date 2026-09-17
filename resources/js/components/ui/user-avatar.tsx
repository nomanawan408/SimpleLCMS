import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
    user?: { full_name?: string | null; name?: string | null; avatar_url?: string | null } | null;
    className?: string;
    fallbackClassName?: string;
}

/**
 * User photo with initials fallback. Falls back to initials whenever there
 * is no photo (or it fails to load), so every caller gets a sensible
 * circle without branching.
 */
export function UserAvatar({ user, className, fallbackClassName }: UserAvatarProps) {
    const name = user?.full_name || user?.name || '?';

    return (
        <Avatar className={cn('h-7 w-7 shrink-0', className)}>
            <AvatarImage src={user?.avatar_url ?? undefined} alt={name} />
            <AvatarFallback className={cn('bg-primary/10 text-[11px] font-semibold text-primary', fallbackClassName)}>
                {initials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

export default UserAvatar;

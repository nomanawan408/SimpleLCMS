import { useEffect, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard, Briefcase, Users, FileText, Clock, Receipt,
    Calendar, CheckSquare, LogOut, Menu, Search, Radio, ChevronDown,
    Building2, Shield, Activity, BarChart2, Landmark, CreditCard, Database,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GlobalSearch } from '@/components/GlobalSearch';
import { NotificationBell } from '@/components/NotificationBell';
import { cn, initials } from '@/lib/utils';
import type { PageProps } from '@/types';

interface NavItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    routeName: string;
    adminOnly?: boolean;
    permission?: string;
    children?: NavItem[];
}

const navItems: NavItem[] = [
    { label: 'Dashboard',  href: '/dashboard',   icon: LayoutDashboard, routeName: 'dashboard' },
    { label: 'Matters',    href: '/matters',      icon: Briefcase,       routeName: 'matters.index',  permission: 'view_matters' },
    { label: 'Contacts',   href: '/contacts',     icon: Users,           routeName: 'contacts.index', permission: 'view_contacts' },
    { label: 'Documents',  href: '/documents',    icon: FileText,        routeName: 'documents.index', permission: 'view_documents' },
    { label: 'Time',         href: '/time',         icon: Clock,       routeName: 'time.index',       permission: 'view_time_entries',
        children: [
            { label: 'Active', href: '/time/sessions', icon: Radio, routeName: 'time.sessions', permission: 'manage_time_entries' },
        ] },
    { label: 'Billing',      href: '/billing',      icon: Receipt,     routeName: 'billing.index',    permission: 'view_invoices' },
    { label: 'Transactions', href: '/transactions', icon: CreditCard,  routeName: 'transactions.index', permission: 'view_invoices' },
    { label: 'Calendar',     href: '/calendar',     icon: Calendar,    routeName: 'calendar.index',   permission: 'view_calendar' },
    { label: 'Tasks',      href: '/tasks',        icon: CheckSquare,     routeName: 'tasks.index',     permission: 'view_tasks' },
    { label: 'Activities', href: '/activities',   icon: Activity,        routeName: 'activities.index' },
    { label: 'Reports',    href: '/reports',      icon: BarChart2,       routeName: 'reports.index',   permission: 'view_reports' },
    { label: 'Accounts',   href: '/accounts',     icon: Landmark,        routeName: 'accounts.index', permission: 'view_trust' },
];

const adminItems: NavItem[] = [
    { label: 'Users',      href: '/admin/users',       icon: Shield,     routeName: 'admin.users.index', adminOnly: true },
    { label: 'Roles',      href: '/admin/roles',       icon: Shield,     routeName: 'admin.roles.index', adminOnly: true },
    { label: 'Firm Setup', href: '/admin/firm/setup',  icon: Building2,  routeName: 'admin.firm.setup',  adminOnly: true },
];

const superAdminNavItems: NavItem[] = [
    { label: 'Dashboard',    href: '/superadmin/dashboard', icon: LayoutDashboard, routeName: 'superadmin.dashboard' },
    { label: 'Manage Firms', href: '/superadmin/firms',     icon: Building2,       routeName: 'superadmin.firms.index' },
    { label: 'Manage Users', href: '/superadmin/users',     icon: Shield,          routeName: 'superadmin.users.index' },
    { label: 'System Backup', href: '/superadmin/backups',  icon: Database,        routeName: 'superadmin.backups.index' },
];

interface AppLayoutProps {
    children: React.ReactNode;
    title?: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
    const { auth, flash } = usePage<PageProps>().props;
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
    const [searchOpen, setSearchOpen] = useState(false);
    const { url } = usePage();
    const user = auth.user!;

    // Cmd+K on Mac, Ctrl+K elsewhere -- the standard shortcut for "open
    // search" (Linear, GitHub, Notion, Stripe all use it), available from
    // anywhere in the app, not just when the button itself is focused.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setSearchOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const isSuperAdmin = user.roles?.includes('super_admin') ?? false;
    const isFirmAdmin = user.roles?.includes('firm_admin') ?? false;

    // Longest href match wins so /time/sessions doesn't also highlight /time.
    const visibleChildren = (item: NavItem): NavItem[] =>
        (item.children ?? []).filter((c) => !c.permission || user.permissions?.includes(c.permission));

    const allNavItems = [
        ...navItems.flatMap((i) => [i, ...visibleChildren(i)]),
        ...adminItems,
    ];
    const bestMatch = allNavItems
        .filter((i) => url === i.href || url.startsWith(i.href + '/'))
        .sort((a, b) => b.href.length - a.href.length)[0];
    const isActive = (item: NavItem) => bestMatch?.href === item.href || (url === item.href);

    const visibleNavItems = navItems.filter(
        (item) => !item.permission || user.permissions?.includes(item.permission),
    );

    const handleLogout = () => {
        router.post('/logout');
    };

    const SidebarContent = () => (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-20 items-center px-6">
                <Link href={isSuperAdmin ? '/superadmin/dashboard' : '/dashboard'} className="flex items-center gap-3">
                    <img src="/assets/simplelaw-logo-primary.png" alt="Simple Law" className="h-12 w-12 shrink-0 object-contain" />
                    <div className="leading-tight min-w-0">
                        <p className="text-base font-bold text-white tracking-tight whitespace-nowrap">Simple Law</p>
                        <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-white/60 font-medium whitespace-nowrap">Case Management</p>
                    </div>
                </Link>
            </div>

             <Separator className="bg-white/15" />

            {/* Firm name (for firm users only) */}
            {!isSuperAdmin && user.firm && (
                <div className="px-4 py-4">
                     <p className="text-xs font-semibold text-white/70 uppercase tracking-[0.15em]">Firm</p>
                    <p className="mt-1 text-sm font-medium text-white truncate">{user.firm.name}</p>
                </div>
            )}

            {/* Nav */}
             <nav className="sidebar-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
                {(isSuperAdmin ? superAdminNavItems : visibleNavItems).map((item) => {
                    const children = isSuperAdmin ? [] : visibleChildren(item);
                    const hasChildren = children.length > 0;
                    // Auto-open while the section is active; manual toggles override.
                    const sectionActive = isActive(item) || children.some((c) => isActive(c));
                    const open = hasChildren && (openMenus[item.routeName] ?? sectionActive);
                    return (
                        <div key={item.routeName}>
                            <div className="relative">
                                <Link
                                    href={item.href}
                                    onClick={() => {
                                        if (hasChildren) setOpenMenus((m) => ({ ...m, [item.routeName]: true }));
                                    }}
                                    className={cn(
                                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                        hasChildren && 'pr-12',
                                        isActive(item)
                                            ? 'bg-slate-800 text-white shadow-sm'
                                            : 'text-white hover:bg-white/10 hover:text-white',
                                    )}
                                >
                                    <item.icon className={cn(
                                        'h-4 w-4 shrink-0 transition-colors',
                                            isActive(item) ? 'text-white' : 'text-white/80 group-hover:text-white'
                                    )} />
                                    {item.label}
                                    {isActive(item) && !hasChildren && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                                </Link>
                                {hasChildren && (
                                    <button
                                        type="button"
                                        aria-label={open ? 'Collapse' : 'Expand'}
                                        onClick={() => setOpenMenus((m) => ({ ...m, [item.routeName]: !open }))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                        <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', !open && '-rotate-90')} />
                                    </button>
                                )}
                            </div>
                            {hasChildren && (
                                <div
                                    className={cn(
                                        'grid transition-all duration-300 ease-in-out',
                                        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                                    )}
                                >
                                    <div className="overflow-hidden">
                                        <div className="ml-3 mt-0.5 space-y-0.5">
                                            {children.map((child) => (
                                                <Link
                                                    key={child.routeName}
                                                    href={child.href}
                                                    className={cn(
                                                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                                        isActive(child)
                                                            ? 'bg-slate-800 text-white shadow-sm'
                                                            : 'text-white/80 hover:bg-white/10 hover:text-white',
                                                    )}
                                                >
                                                    <child.icon className={cn(
                                                        'h-4 w-4 shrink-0 transition-colors',
                                                        isActive(child) ? 'text-white' : 'text-white/50 group-hover:text-white',
                                                    )} />
                                                    {child.label}
                                                    {isActive(child) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {!isSuperAdmin && (isFirmAdmin || user.permissions?.includes('manage_users')) && (
                    <>
                        <div className="pt-5 pb-2">
                             <p className="px-3 text-xs font-semibold text-white/70 uppercase tracking-[0.15em]">Admin</p>
                        </div>
                        {adminItems.map((item) => (
                            <Link
                                key={item.routeName}
                                href={item.href}
                                className={cn(
                                     'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                    isActive(item)
                                         ? 'bg-white text-brand-900 shadow-sm'
                                         : 'text-white hover:bg-white/10 hover:text-white',
                                )}
                            >
                                <item.icon className={cn(
                                    'h-4 w-4 shrink-0',
isActive(item) ? 'text-white' : 'text-white/80 group-hover:text-white'
                                )} />
                                {item.label}
                            </Link>
                        ))}
                    </>
                )}
            </nav>

             <Separator className="bg-white/15" />

            {/* User */}
            <div className="p-4">
                 <div className="rounded-xl border border-white/15 bg-white/10 p-3">
                    <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white/10">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-brand-500 text-brand-950 text-xs font-bold">
                            {initials(user.full_name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                         <p className="truncate text-sm font-medium text-white">{user.full_name}</p>
                         <p className="truncate text-xs text-white/70">{user.email}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white" onClick={handleLogout} title="Sign out">
                        <LogOut className="h-4 w-4" />
                    </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen h-[100dvh] overflow-hidden bg-background">
            {/* Desktop sidebar - ink surface with a warm accent at the base */}
            <aside className="hidden shrink-0 overflow-hidden lg:flex lg:w-60 lg:flex-col" style={{background: '#0F172A', borderRight: '1px solid #1E293B'}}>
                <SidebarContent />
            </aside>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
                    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col overflow-hidden shadow-2xl" style={{background: '#0F172A', borderRight: '1px solid #1E293B'}}>
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* Main content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Topbar */}
                <header className="flex h-[64px] lg:h-[72px] items-center justify-between border-b border-border/70 bg-card px-5 lg:px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10" onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="h-6 w-6" />
                        </Button>
                        {title && (
                            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground leading-tight truncate max-w-[42rem]" title={title}>{title}</h1>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            pill
                            className="hidden gap-2 md:inline-flex"
                            onClick={() => setSearchOpen(true)}
                        >
                            <Search className="h-4 w-4" />
                            Search
                        </Button>
                        <NotificationBell />
                        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-2 text-sm">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={user.avatar_url ?? undefined} />
                                <AvatarFallback className="bg-brand-500 text-brand-950 text-sm font-bold">
                                    {initials(user.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            <span className="hidden sm:block font-medium text-base text-foreground">{user.full_name}</span>
                        </div>
                    </div>
                </header>

                {/* Flash messages */}
                {(flash.success || flash.error || flash.warning) && (
                    <div className="px-4 pt-4 lg:px-6 space-y-2">
                        {flash.success && (
                            <div className="flash-success">
                                {flash.success}
                            </div>
                        )}
                        {flash.error && (
                            <div className="flash-error">
                                {flash.error}
                            </div>
                        )}
                        {flash.warning && (
                            <div className="flash-warning">
                                {flash.warning}
                            </div>
                        )}
                    </div>
                )}

                {/* Page content */}
                <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background p-5 lg:p-10">
                    <div className="mx-auto w-full max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>

            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
    );
}

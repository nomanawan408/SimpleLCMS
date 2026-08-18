import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard, Briefcase, Users, FileText, Clock, Receipt,
    Calendar, CheckSquare, LogOut, Menu, Bell, Search,
    Building2, Shield, Activity, BarChart2, Landmark, CreditCard, Database,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn, initials } from '@/lib/utils';
import type { PageProps } from '@/types';

interface NavItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    routeName: string;
    adminOnly?: boolean;
    permission?: string;
}

const navItems: NavItem[] = [
    { label: 'Dashboard',  href: '/dashboard',   icon: LayoutDashboard, routeName: 'dashboard' },
    { label: 'Matters',    href: '/matters',      icon: Briefcase,       routeName: 'matters.index',  permission: 'view_matters' },
    { label: 'Contacts',   href: '/contacts',     icon: Users,           routeName: 'contacts.index', permission: 'view_contacts' },
    { label: 'Documents',  href: '/documents',    icon: FileText,        routeName: 'documents.index', permission: 'view_documents' },
    { label: 'Time',         href: '/time',         icon: Clock,       routeName: 'time.index',       permission: 'view_time_entries' },
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
    const { url } = usePage();
    const user = auth.user!;

    const isActive = (item: NavItem) => url.startsWith(item.href);
    const isSuperAdmin = user.roles?.includes('super_admin') ?? false;
    const isFirmAdmin = user.roles?.includes('firm_admin') ?? false;

    const visibleNavItems = navItems.filter(
        (item) => !item.permission || user.permissions?.includes(item.permission),
    );

    const handleLogout = () => {
        router.post('/logout');
    };

    const SidebarContent = () => (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center px-5">
                <Link href={isSuperAdmin ? '/superadmin/dashboard' : '/dashboard'} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 ring-2 ring-white shadow-lg">
                        <span className="text-xs font-bold text-white">SLCM</span>
                    </div>
                    <div>
                        <p className="text-base font-bold text-white tracking-tight">Simple Law</p>
                         <p className="text-[10px] uppercase tracking-[0.22em] text-white font-medium">
                            {isSuperAdmin ? 'Platform Admin' : 'Case Management'}
                        </p>
                    </div>
                </Link>
            </div>

             <Separator className="bg-[#484848]" />

            {/* Firm name (for firm users only) */}
            {!isSuperAdmin && user.firm && (
                <div className="px-4 py-4">
                     <p className="text-[11px] font-semibold text-white uppercase tracking-[0.15em]">Firm</p>
                    <p className="mt-1 text-sm font-medium text-white truncate">{user.firm.name}</p>
                </div>
            )}

            {/* Nav */}
             <nav className="sidebar-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
                {(isSuperAdmin ? superAdminNavItems : visibleNavItems).map((item) => (
                    <Link
                        key={item.routeName}
                        href={item.href}
                        className={cn(
                            'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive(item)
                                 ? 'bg-white text-[#272727] shadow-sm'
                                 : 'text-white hover:bg-[#333333] hover:text-white',
                        )}
                    >
                        <item.icon className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                             isActive(item) ? 'text-[#FF4000]' : 'text-white/80 group-hover:text-white'
                        )} />
                        {item.label}
                        {isActive(item) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#FF4000]" />}
                    </Link>
                ))}

                {!isSuperAdmin && (isFirmAdmin || user.permissions?.includes('manage_users')) && (
                    <>
                        <div className="pt-5 pb-2">
                             <p className="px-3 text-[11px] font-semibold text-white/70 uppercase tracking-[0.15em]">Admin</p>
                        </div>
                        {adminItems.map((item) => (
                            <Link
                                key={item.routeName}
                                href={item.href}
                                className={cn(
                                     'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                                    isActive(item)
                                         ? 'bg-white text-[#272727] shadow-sm'
                                         : 'text-white hover:bg-[#333333] hover:text-white',
                                )}
                            >
                                <item.icon className={cn(
                                    'h-4 w-4 shrink-0',
                                     isActive(item) ? 'text-[#FF4000]' : 'text-white/80 group-hover:text-white'
                                )} />
                                {item.label}
                            </Link>
                        ))}
                    </>
                )}
            </nav>

             <Separator className="bg-[#484848]" />

            {/* User */}
            <div className="p-4">
                 <div className="rounded-xl border border-[#484848] bg-[#303030] p-3">
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
                    <Button
                        variant="ghost"
                        size="icon"
                         className="h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white"
                        onClick={handleLogout}
                        title="Sign out"
                    >
                        <LogOut className="h-4 w-4" />
                    </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Desktop sidebar - ink surface with a warm accent at the base */}
            <aside className="hidden shrink-0 overflow-hidden lg:flex lg:w-60 lg:flex-col" style={{background: '#272727', borderRight: '1px solid #3a3a3a'}}>
                <SidebarContent />
            </aside>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
                    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col overflow-hidden shadow-2xl" style={{background: '#272727', borderRight: '1px solid #3a3a3a'}}>
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Topbar */}
                <header className="flex h-[72px] items-center justify-between border-b border-border/70 bg-card px-4 lg:px-7 shrink-0">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden h-9 w-9"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                        {title && (
                            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{title}</h1>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="hidden h-9 gap-2 rounded-full border-0 bg-foreground px-4 text-xs text-background hover:bg-foreground/90 md:inline-flex">
                            <Search className="h-4 w-4" />
                            Search
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 relative text-muted-foreground">
                            <Bell className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm">
                            <Avatar className="h-7 w-7">
                                <AvatarImage src={user.avatar_url ?? undefined} />
                                <AvatarFallback className="bg-brand-500 text-brand-950 text-xs font-bold">
                                    {initials(user.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            <span className="hidden sm:block font-medium text-sm text-foreground">{user.full_name}</span>
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
                <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-7">
                    <div className="mx-auto w-full max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

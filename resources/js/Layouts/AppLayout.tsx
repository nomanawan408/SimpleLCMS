import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard, Briefcase, Users, FileText, Clock, Receipt,
    Calendar, CheckSquare, LogOut, Menu, Bell, Search,
    Building2, Shield, Activity, BarChart2, Landmark, CreditCard,
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
}

const navItems: NavItem[] = [
    { label: 'Dashboard',  href: '/dashboard',   icon: LayoutDashboard, routeName: 'dashboard' },
    { label: 'Matters',    href: '/matters',      icon: Briefcase,       routeName: 'matters.index' },
    { label: 'Contacts',   href: '/contacts',     icon: Users,           routeName: 'contacts.index' },
    { label: 'Documents',  href: '/documents',    icon: FileText,        routeName: 'documents.index' },
    { label: 'Time',         href: '/time',         icon: Clock,       routeName: 'time.index' },
    { label: 'Billing',      href: '/billing',      icon: Receipt,     routeName: 'billing.index' },
    { label: 'Transactions', href: '/transactions', icon: CreditCard,  routeName: 'transactions.index' },
    { label: 'Calendar',     href: '/calendar',     icon: Calendar,    routeName: 'calendar.index' },
    { label: 'Tasks',      href: '/tasks',        icon: CheckSquare,     routeName: 'tasks.index' },
    { label: 'Activities', href: '/activities',   icon: Activity,        routeName: 'activities.index' },
    { label: 'Reports',    href: '/reports',      icon: BarChart2,       routeName: 'reports.index' },
    { label: 'Accounts',   href: '/accounts',     icon: Landmark,        routeName: 'accounts.index' },
];

const adminItems: NavItem[] = [
    { label: 'Users',      href: '/admin/users',       icon: Shield,     routeName: 'admin.users.index', adminOnly: true },
    { label: 'Firm Setup', href: '/admin/firm/setup',  icon: Building2,  routeName: 'admin.firm.setup',  adminOnly: true },
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

    const handleLogout = () => {
        router.post('/logout');
    };

    const SidebarContent = () => (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center px-5">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 ring-1 ring-white/20">
                        <span className="text-xs font-bold text-white">LD</span>
                    </div>
                    <div>
                        <p className="text-base font-semibold text-white tracking-tight">Simple Lawyer</p>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Management System</p>
                    </div>
                </Link>
            </div>

            <Separator className="bg-white/10" />

            {/* Firm name */}
            {user.firm && (
                <div className="px-4 py-4">
                    <p className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.15em]">Firm</p>
                    <p className="mt-1 text-sm font-medium text-white truncate">{user.firm.name}</p>
                </div>
            )}

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => (
                    <Link
                        key={item.routeName}
                        href={item.href}
                        className={cn(
                            'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                            isActive(item)
                                ? 'bg-brand-500 text-white shadow-md'
                                : 'text-white/70 hover:bg-white/10 hover:text-white',
                        )}
                    >
                        <item.icon className={cn(
                            'h-4 w-4 shrink-0',
                            isActive(item) ? 'text-white' : 'text-white/60 group-hover:text-white'
                        )} />
                        {item.label}
                    </Link>
                ))}

                {(['administrator', 'manager'] as string[]).includes(user.role) && (
                    <>
                        <div className="pt-5 pb-2">
                            <p className="px-3 text-[11px] font-semibold text-white/40 uppercase tracking-[0.15em]">Admin</p>
                        </div>
                        {adminItems.map((item) => (
                            <Link
                                key={item.routeName}
                                href={item.href}
                                className={cn(
                                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                                    isActive(item)
                                        ? 'bg-white/12 text-white shadow-sm ring-1 ring-white/15'
                                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                                )}
                            >
                                <item.icon className={cn(
                                    'h-4 w-4 shrink-0',
                                    isActive(item) ? 'text-white' : 'text-white/60 group-hover:text-white'
                                )} />
                                {item.label}
                            </Link>
                        ))}
                    </>
                )}
            </nav>

            <Separator className="bg-white/10" />

            {/* User */}
            <div className="p-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0 ring-2 ring-white/10">
                        <AvatarImage src={user.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-brand-500 text-white text-xs font-medium">
                            {initials(user.full_name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                        <p className="text-xs text-white/50 truncate">{user.email}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
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
            {/* Desktop sidebar - Dark with purple theme */}
            <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 border-r border-white/10 shrink-0">
                <SidebarContent />
            </aside>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
                    <aside className="fixed inset-y-0 left-0 w-64 flex flex-col bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 border-r border-white/10 shadow-2xl">
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* Main content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Topbar */}
                <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-6 shrink-0">
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
                            <h1 className="text-base font-semibold tracking-tight text-foreground">{title}</h1>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="hidden md:inline-flex gap-2 h-9 text-muted-foreground border-border/60">
                            <Search className="h-4 w-4" />
                            Search
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 relative text-muted-foreground">
                            <Bell className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm">
                            <Avatar className="h-7 w-7">
                                <AvatarImage src={user.avatar_url ?? undefined} />
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
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
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <div className="mx-auto w-full max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

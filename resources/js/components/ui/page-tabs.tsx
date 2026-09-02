import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageTab {
    key: string;
    label: string;
    icon?: LucideIcon;
    /** Shown as a pill after the label. Null or 0 hides it. */
    count?: number | null;
}

interface PageTabsProps {
    tabs: PageTab[];
    value: string;
    onChange: (key: string) => void;
    className?: string;
}

/**
 * The segmented tab bar used on record pages (a matter, a contact).
 *
 * Sizing lives here rather than at each call site so the two pages cannot
 * drift apart again. Everything is rem-based, so the bar grows with the fluid
 * root size instead of staying pinned at a fixed pixel size on large displays.
 */
export function PageTabs({ tabs, value, onChange, className }: PageTabsProps) {
    return (
        <div className={cn('mb-3', className)}>
            <div
                role="tablist"
                className="flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/30 w-fit max-w-full overflow-x-auto"
            >
                {tabs.map((tab) => {
                    const active = value === tab.key;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => onChange(tab.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                active
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-card text-foreground border-transparent hover:text-primary hover:bg-primary/[0.06] hover:border-primary/20',
                            )}
                        >
                            {Icon && <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-foreground' : 'text-muted-foreground')} />}
                            {tab.label}
                            {tab.count != null && tab.count > 0 && (
                                <span
                                    className={cn(
                                        'inline-flex items-center justify-center min-w-[1.4em] h-5 px-1.5 rounded-full text-xs font-bold tabular-nums',
                                        active ? 'bg-white text-primary' : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

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
        <div className={cn('mb-6', className)}>
            <div
                role="tablist"
                className="flex items-center gap-1 p-1 rounded-2xl bg-muted/40 border border-border/40 w-fit max-w-full overflow-x-auto"
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
                                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                                active
                                    ? 'bg-card text-foreground shadow-sm border border-border/60'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-card/60',
                            )}
                        >
                            {Icon && <Icon className="h-4 w-4 shrink-0" />}
                            {tab.label}
                            {tab.count != null && tab.count > 0 && (
                                <span
                                    className={cn(
                                        'inline-flex items-center justify-center min-w-[1.5em] h-5 px-1.5 rounded-full text-xs font-bold tabular-nums',
                                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
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

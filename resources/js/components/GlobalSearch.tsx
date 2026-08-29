import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Briefcase, CheckSquare, FileText, Loader2, Receipt, Users } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface SearchResult {
    id: string;
    title: string;
    subtitle: string | null;
    url: string;
}

type ResultCategory = 'matters' | 'contacts' | 'documents' | 'invoices' | 'tasks';

const CATEGORY_META: Record<ResultCategory, { label: string; icon: typeof Briefcase }> = {
    matters: { label: 'Matters', icon: Briefcase },
    contacts: { label: 'Contacts', icon: Users },
    documents: { label: 'Documents', icon: FileText },
    invoices: { label: 'Invoices', icon: Receipt },
    tasks: { label: 'Tasks', icon: CheckSquare },
};

// The order results are grouped in, regardless of what order the server
// happens to return them in.
const CATEGORY_ORDER: ResultCategory[] = ['matters', 'contacts', 'documents', 'invoices', 'tasks'];

interface GlobalSearchProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * The header's search button opens this: a command palette searching
 * matters, contacts, documents, invoices and tasks at once. Also opens on
 * Cmd/Ctrl+K from anywhere, wired up in AppLayout.
 */
export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Partial<Record<ResultCategory, SearchResult[]>>>({});
    const [loading, setLoading] = useState(false);
    const requestId = useRef(0);

    // Fresh search each time the palette opens, rather than showing whatever
    // was last typed the previous time it was used.
    useEffect(() => {
        if (open) {
            setQuery('');
            setResults({});
        }
    }, [open]);

    useEffect(() => {
        const trimmed = query.trim();

        if (trimmed.length < 2) {
            setResults({});
            setLoading(false);
            return;
        }

        setLoading(true);
        const currentRequest = ++requestId.current;
        const timeout = setTimeout(() => {
            fetch(`/search?q=${encodeURIComponent(trimmed)}`, {
                headers: { Accept: 'application/json' },
            })
                .then((res) => res.json())
                .then((data) => {
                    // A slower earlier request finishing after a newer one
                    // must not overwrite it with stale results.
                    if (currentRequest === requestId.current) {
                        setResults(data.results ?? {});
                    }
                })
                .catch(() => {
                    if (currentRequest === requestId.current) setResults({});
                })
                .finally(() => {
                    if (currentRequest === requestId.current) setLoading(false);
                });
        }, 200);

        return () => clearTimeout(timeout);
    }, [query]);

    const select = (url: string) => {
        onOpenChange(false);
        router.visit(url);
    };

    const hasAnyResults = CATEGORY_ORDER.some((cat) => (results[cat]?.length ?? 0) > 0);
    const showEmpty = query.trim().length >= 2 && !loading && !hasAnyResults;

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Search matters, contacts, documents, invoices, tasks…"
            />
            <CommandList>
                {query.trim().length < 2 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        Type at least 2 characters to search.
                    </div>
                )}

                {loading && query.trim().length >= 2 && (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching…
                    </div>
                )}

                {showEmpty && <CommandEmpty>No results for &ldquo;{query.trim()}&rdquo;.</CommandEmpty>}

                {!loading && CATEGORY_ORDER.map((category) => {
                    const items = results[category];
                    if (!items || items.length === 0) return null;

                    const { label, icon: Icon } = CATEGORY_META[category];

                    return (
                        <CommandGroup key={category} heading={label}>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={`${category}-${item.id}`}
                                    onSelect={() => select(item.url)}
                                >
                                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                    {item.subtitle && (
                                        <span className="shrink-0 truncate text-xs text-muted-foreground">{item.subtitle}</span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    );
                })}
            </CommandList>
        </CommandDialog>
    );
}

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export interface ComboboxOption {
    value: string;
    label: string;
    /** Shown under the label, in muted text, and also matched when filtering. */
    description?: string;
}

interface ComboboxProps {
    options: ComboboxOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    disabled?: boolean;
    id?: string;
}

/**
 * A searchable single-select. Use this instead of Select whenever the list is
 * long enough that scanning it isn't realistic -- clients, contacts, matters,
 * anything sourced from the database rather than a short fixed enum. Select
 * itself has no search box; typing while it's open only jumps focus to the
 * first item matching the letters so far (native browser typeahead), it does
 * not filter the list.
 */
export function Combobox({
    options,
    value,
    onChange,
    placeholder = 'Search…',
    searchPlaceholder = 'Type to search…',
    emptyText = 'No results found.',
    className,
    disabled,
    id,
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const selected = options.find((o) => o.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    id={id}
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
                        'ring-offset-background placeholder:text-muted-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        className,
                    )}
                >
                    <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
                        {selected ? selected.label : placeholder}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                <Command
                    filter={(itemValue, search) => {
                        const option = options.find((o) => o.value === itemValue);
                        if (!option) return 0;
                        const haystack = `${option.label} ${option.description ?? ''}`.toLowerCase();
                        return haystack.includes(search.toLowerCase()) ? 1 : 0;
                    }}
                >
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={(current) => {
                                        onChange(current === value ? '' : current);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn('h-4 w-4 shrink-0', value === option.value ? 'opacity-100' : 'opacity-0')} />
                                    <span className="min-w-0 flex-1 truncate">
                                        {option.label}
                                        {option.description && (
                                            <span className="block truncate text-xs text-muted-foreground">{option.description}</span>
                                        )}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

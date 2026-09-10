import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
    type ColumnOrderState,
    type ColumnSizingState,
    type Header,
    type VisibilityState,
} from '@tanstack/react-table';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Columns3, Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTablePreferences } from '@/components/table/useTablePreferences';
import type { TablePreferences } from '@/lib/tablePreferences';

export interface DynamicColumn<T> {
    id: string;
    header: string;
    defaultWidth?: number;
    minWidth?: number;
    maxWidth?: number;
    /** false locks the column visible (e.g. the Matter title). */
    hideable?: boolean;
    /** false hides the column until the user enables it (for opt-in columns). */
    defaultVisible?: boolean;
    cell: (row: T) => ReactNode;
    cellClassName?: string;
}

interface DynamicTableProps<T> {
    tableKey: string;
    columns: DynamicColumn<T>[];
    data: T[];
    initialPreferences?: TablePreferences | null;
    getRowId?: (row: T, index: number) => string;
    onRowClick?: (row: T) => void;
    minTableWidth?: number;
    emptyState?: ReactNode;
}

function mergeOrder(saved: string[] | undefined, allIds: string[]): string[] {
    if (!saved || saved.length === 0) return allIds;
    const known = saved.filter((id) => allIds.includes(id));
    const missing = allIds.filter((id) => !known.includes(id));
    return [...known, ...missing];
}

function SortableHeader<T>({ header, children }: { header: Header<T, unknown>; children: ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: header.column.id });
    return (
        <th
            ref={setNodeRef}
            colSpan={header.colSpan}
            style={{ width: header.getSize() }}
            className={cn(
                'relative h-11 select-none bg-muted/40 px-4 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                isDragging && 'opacity-60',
            )}
        >
            <span className="flex items-center gap-1.5">
                <button
                    type="button"
                    aria-label={`Reorder ${String(header.column.columnDef.header ?? header.column.id)}`}
                    title="Drag to reorder"
                    className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-3.5 w-3.5" />
                </button>
                <span className="truncate">{children}</span>
            </span>
            <span
                onMouseDown={header.getResizeHandler()}
                onTouchStart={header.getResizeHandler()}
                onDoubleClick={() => header.column.resetSize()}
                title="Drag to resize · double-click to reset"
                className={cn(
                    'group absolute right-0 top-0 flex h-full w-[12px] cursor-col-resize touch-none select-none items-center justify-center',
                    header.column.getIsResizing() ? 'bg-primary/10' : 'hover:bg-primary/5',
                )}
            >
                <span
                    aria-hidden
                    className={cn(
                        'h-4 w-px rounded-full bg-border transition-all duration-150',
                        'group-hover:h-6 group-hover:bg-primary/40',
                        header.column.getIsResizing() && 'h-full w-0.5 !bg-primary/60',
                    )}
                />
            </span>
        </th>
    );
}

/**
 * Reusable dynamic table: hide / resize / reorder columns, persisted per user.
 *
 * Built on TanStack Table (state) + dnd-kit (header drag). Styling matches the
 * shared `ui/table` primitives (11px uppercase headers, px-4 py-3.5 cells) so
 * it reads as the same app, not a third-party grid.
 */
export function DynamicTable<T>({
    tableKey,
    columns,
    data,
    initialPreferences,
    getRowId,
    onRowClick,
    minTableWidth = 960,
    emptyState,
}: DynamicTableProps<T>) {
    const allIds = useMemo(() => columns.map((c) => c.id), [columns]);
    const { prefs, saving, update, reset } = useTablePreferences(tableKey, initialPreferences);

    // Opt-in columns (defaultVisible === false) stay hidden until the user
    // enables them; an explicit saved preference always wins over the default.
    const defaultVisibility = useMemo<VisibilityState>(() => {
        const v: VisibilityState = {};
        for (const c of columns) if (c.defaultVisible === false) v[c.id] = false;
        return v;
    }, [columns]);
    const mergeVisibility = (saved?: Record<string, boolean>): VisibilityState => ({
        ...defaultVisibility,
        ...(saved ?? {}),
    });

    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => mergeOrder(prefs?.order, allIds));
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => mergeVisibility(prefs?.visibility));
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => prefs?.widths ?? {});

    // Server prop (or a reset to null) is authoritative when it changes.
    const prefsKey = JSON.stringify(prefs ?? null);
    useEffect(() => {
        setColumnOrder(mergeOrder(prefs?.order, allIds));
        setColumnVisibility(mergeVisibility(prefs?.visibility));
        setColumnSizing(prefs?.widths ?? {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefsKey]);

    const tanstackColumns = useMemo<ColumnDef<T>[]>((
        () => columns.map((col) => ({
            id: col.id,
            header: col.header,
            size: col.defaultWidth ?? 150,
            minSize: col.minWidth ?? 80,
            maxSize: col.maxWidth ?? 600,
            enableHiding: col.hideable !== false,
            enableResizing: true,
            cell: (info) => col.cell(info.row.original),
        }))),
        [columns],
    );

    const table = useReactTable({
        data,
        columns: tanstackColumns,
        state: { columnOrder, columnVisibility, columnSizing },
        onColumnOrderChange: (updater) => {
            setColumnOrder((old) => {
                const next = typeof updater === 'function' ? updater(old) : updater;
                update({ order: next });
                return next;
            });
        },
        onColumnVisibilityChange: (updater) => {
            setColumnVisibility((old) => {
                const next = typeof updater === 'function' ? updater(old) : updater;
                update({ visibility: next });
                return next;
            });
        },
        onColumnSizingChange: (updater) => {
            setColumnSizing((old) => {
                const next = typeof updater === 'function' ? updater(old) : updater;
                update({ widths: next });
                return next;
            });
        },
        columnResizeMode: 'onChange',
        enableColumnResizing: true,
        getCoreRowModel: getCoreRowModel(),
        getRowId: getRowId ? (row, index) => getRowId(row, index) : undefined,
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setColumnOrder((old) => {
            const oldIndex = old.indexOf(String(active.id));
            const newIndex = old.indexOf(String(over.id));
            if (oldIndex < 0 || newIndex < 0) return old;
            const next = arrayMove(old, oldIndex, newIndex);
            update({ order: next });
            return next;
        });
    };

    const handleReset = () => {
        setColumnOrder(allIds);
        setColumnVisibility(defaultVisibility);
        setColumnSizing({});
        reset();
    };

    const visibleCount = table.getVisibleLeafColumns().length;
    const customized = (prefs?.order?.length ?? 0) > 0 || Object.keys(prefs?.widths ?? {}).length > 0 || Object.keys(prefs?.visibility ?? {}).length > 0;

    return (
        <div className="w-full">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
                <p className="text-xs text-muted-foreground">
                    {saving ? 'Saving layout…' : customized ? 'Custom layout' : 'Default layout'}
                </p>
                <div className="flex items-center gap-1.5">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                <Columns3 className="h-3.5 w-3.5" />
                                Columns
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="max-h-80 w-56 overflow-y-auto p-1.5">
                            <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Show columns
                            </p>
                            {table.getAllLeafColumns().map((column) => {
                                if (!column.getCanHide()) return null;
                                const visible = column.getIsVisible();
                                const label = String(column.columnDef.header ?? column.id);
                                return (
                                    <button
                                        key={column.id}
                                        type="button"
                                        disabled={!visible && visibleCount <= 1}
                                        onClick={() => column.toggleVisibility(!visible)}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <span className="flex h-4 w-4 items-center justify-center rounded border border-border bg-background">
                                            {visible && <Check className="h-3 w-3 text-primary" />}
                                        </span>
                                        <span className="flex-1 truncate">{label}</span>
                                        {visible ? (
                                            <Eye className="h-3.5 w-3.5 text-muted-foreground/60" />
                                        ) : (
                                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground/60" />
                                        )}
                                    </button>
                                );
                            })}
                        </PopoverContent>
                    </Popover>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        disabled={!customized && !saving}
                        className="h-8 gap-1.5 text-xs text-muted-foreground"
                        title="Reset to default layout"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                    </Button>
                </div>
            </div>

            <div className="w-full overflow-x-auto">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <table
                        className="w-full caption-bottom border-collapse text-sm"
                        style={{ tableLayout: 'fixed', width: '100%', minWidth: Math.max(minTableWidth, table.getTotalSize()) }}
                    >
                        <thead className="[&_tr]:border-b [&_tr]:border-border/60">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                                        {headerGroup.headers.map((header) => (
                                            <SortableHeader key={header.id} header={header}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : typeof header.column.columnDef.header === 'string'
                                                      ? header.column.columnDef.header
                                                      : header.column.id}
                                            </SortableHeader>
                                        ))}
                                    </SortableContext>
                                </tr>
                            ))}
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                            {table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleCount || 1} className="px-4 py-10 text-center">
                                        {emptyState ?? <p className="text-sm text-muted-foreground">No rows found.</p>}
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <tr
                                        key={row.id}
                                        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                                        className={cn(
                                            'border-b border-border/60 transition-colors hover:bg-muted/40',
                                            onRowClick && 'cursor-pointer',
                                        )}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <td
                                                key={cell.id}
                                                style={{ width: cell.column.getSize() }}
                                                className="overflow-hidden px-4 py-3.5 align-middle"
                                            >
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                )))}
                        </tbody>
                    </table>
                </DndContext>
            </div>
        </div>
    );
}

export default DynamicTable;

import { Head, Link, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Trash2, Info } from 'lucide-react';
import type { User, Contact, Matter } from '@/types';

interface Props {
    matter: Matter & { contacts: Contact[] };
    users: User[];
    contacts: Contact[];
}

const FEE_ARRANGEMENT_HINTS: Record<string, string> = {
    hourly_rate: 'Work is billed at an agreed rate per hour. Set the default rate below.',
    fixed_fee:   'A single agreed fee for the entire matter regardless of time spent.',
    contingency: 'No fee unless successful. Set the percentage of the recovered amount.',
    retainer:    'Client pays an upfront amount held on account, topped up as required.',
};

export default function EditMatter({ matter, users, contacts }: Props) {
    const cf = (matter.custom_fields as Record<string, string>) ?? {};

    const { data, setData, put, processing, errors } = useForm({
        name: matter.name,
        description: matter.description || '',
        status: matter.status || 'open',
        practice_area: matter.practice_area || '',
        fee_arrangement: matter.fee_arrangement || '',
        responsible_user_id: matter.responsible_user_id || '',
        contact_ids: matter.contacts?.map((c) => c.id) || [],
        court: (matter as any).court || '',
        court_reference: (matter as any).court_reference || '',
        custom_fields: {
            hourly_rate:            cf.hourly_rate ?? '',
            fixed_amount:           cf.fixed_amount ?? '',
            contingency_percentage: cf.contingency_percentage ?? '',
            retainer_amount:        cf.retainer_amount ?? '',
            retainer_replenish:     cf.retainer_replenish ?? '',
            fee_notes:              cf.fee_notes ?? '',
        } as Record<string, string>,
    });

    const setCustomField = (key: string, value: string) =>
        setData('custom_fields', { ...data.custom_fields, [key]: value });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/matters/${matter.id}`);
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this matter?')) {
            router.delete(`/matters/${matter.id}`);
        }
    };

    return (
        <AppLayout title={`Edit ${matter.name}`}>
            <Head title={`Edit ${matter.name}`} />

            <div className="max-w-2xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href={`/matters/${matter.id}`}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Matter
                        </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                </div>

                <Card className="surface-card">
                    <CardHeader className="pb-6">
                        <CardTitle className="text-xl tracking-tight">Edit Matter</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <form onSubmit={submit} className="space-y-6">

                            {/* ── Matter basics ── */}
                            <div className="space-y-3">
                                <Label htmlFor="name" className="text-sm font-medium">Matter name *</Label>
                                <Input
                                    id="name"
                                    autoFocus
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className="h-11"
                                />
                                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                                <Textarea
                                    id="description"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    placeholder="Brief description of this matter…"
                                    rows={3}
                                    className="resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Status</Label>
                                    <Select value={data.status} onValueChange={(v) => setData('status', v)}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select status…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="open">Open</SelectItem>
                                            <SelectItem value="pending_court_date">Pending Court Date</SelectItem>
                                            <SelectItem value="awaiting_client">Awaiting Client</SelectItem>
                                            <SelectItem value="awaiting_opponent">Awaiting Opponent</SelectItem>
                                            <SelectItem value="on_hold">On Hold</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                            <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.status && <p className="text-xs text-destructive mt-1">{errors.status}</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Practice area *</Label>
                                    <Select
                                        value={data.practice_area}
                                        onValueChange={(v) => setData('practice_area', v)}
                                    >
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select area…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="conveyancing">Conveyancing</SelectItem>
                                            <SelectItem value="family_law">Family Law</SelectItem>
                                            <SelectItem value="litigation">Litigation</SelectItem>
                                            <SelectItem value="employment">Employment</SelectItem>
                                            <SelectItem value="wills_probate">Wills &amp; Probate</SelectItem>
                                            <SelectItem value="corporate">Corporate</SelectItem>
                                            <SelectItem value="immigration">Immigration</SelectItem>
                                            <SelectItem value="criminal">Criminal</SelectItem>
                                            <SelectItem value="personal_injury">Personal Injury</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.practice_area && <p className="text-xs text-destructive mt-1">{errors.practice_area}</p>}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Responsible solicitor *</Label>
                                <Select
                                    value={data.responsible_user_id}
                                    onValueChange={(v) => setData('responsible_user_id', v)}
                                >
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Assign to…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.responsible_user_id && <p className="text-xs text-destructive mt-1">{errors.responsible_user_id}</p>}
                            </div>

                            <Separator />

                            {/* ── Fee Arrangement ── */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-foreground">Fee Arrangement</h3>

                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Billing type *</Label>
                                    <Select
                                        value={data.fee_arrangement}
                                        onValueChange={(v) => setData('fee_arrangement', v)}
                                    >
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="Select…" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hourly_rate">Hourly Rate</SelectItem>
                                            <SelectItem value="fixed_fee">Fixed Fee</SelectItem>
                                            <SelectItem value="contingency">Contingency</SelectItem>
                                            <SelectItem value="retainer">Retainer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.fee_arrangement && <p className="text-xs text-destructive mt-1">{errors.fee_arrangement}</p>}
                                    {data.fee_arrangement && FEE_ARRANGEMENT_HINTS[data.fee_arrangement] && (
                                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                            {FEE_ARRANGEMENT_HINTS[data.fee_arrangement]}
                                        </p>
                                    )}
                                </div>

                                {data.fee_arrangement === 'hourly_rate' && (
                                    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Default hourly rate (£)</Label>
                                            <Input
                                                type="number" min="0" step="0.01"
                                                placeholder="e.g. 250.00"
                                                value={data.custom_fields.hourly_rate}
                                                onChange={(e) => setCustomField('hourly_rate', e.target.value)}
                                                className="h-10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Fee notes</Label>
                                            <Textarea rows={2} className="resize-none text-sm"
                                                placeholder="e.g. Senior partner rate applies for court hearings…"
                                                value={data.custom_fields.fee_notes}
                                                onChange={(e) => setCustomField('fee_notes', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {data.fee_arrangement === 'fixed_fee' && (
                                    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Agreed fixed fee (£)</Label>
                                            <Input
                                                type="number" min="0" step="0.01"
                                                placeholder="e.g. 1500.00"
                                                value={data.custom_fields.fixed_amount}
                                                onChange={(e) => setCustomField('fixed_amount', e.target.value)}
                                                className="h-10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Fee notes</Label>
                                            <Textarea rows={2} className="resize-none text-sm"
                                                placeholder="e.g. Excludes disbursements and VAT…"
                                                value={data.custom_fields.fee_notes}
                                                onChange={(e) => setCustomField('fee_notes', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {data.fee_arrangement === 'contingency' && (
                                    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Contingency percentage (%)</Label>
                                            <Input
                                                type="number" min="0" max="100" step="0.1"
                                                placeholder="e.g. 25"
                                                value={data.custom_fields.contingency_percentage}
                                                onChange={(e) => setCustomField('contingency_percentage', e.target.value)}
                                                className="h-10"
                                            />
                                            <p className="text-xs text-muted-foreground">Percentage of the recovered amount payable as fee.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Fee notes</Label>
                                            <Textarea rows={2} className="resize-none text-sm"
                                                placeholder="e.g. No win, no fee — CFA terms apply…"
                                                value={data.custom_fields.fee_notes}
                                                onChange={(e) => setCustomField('fee_notes', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {data.fee_arrangement === 'retainer' && (
                                    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium">Initial retainer amount (£)</Label>
                                                <Input
                                                    type="number" min="0" step="0.01"
                                                    placeholder="e.g. 2000.00"
                                                    value={data.custom_fields.retainer_amount}
                                                    onChange={(e) => setCustomField('retainer_amount', e.target.value)}
                                                    className="h-10"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium">Replenishment threshold (£)</Label>
                                                <Input
                                                    type="number" min="0" step="0.01"
                                                    placeholder="e.g. 500.00"
                                                    value={data.custom_fields.retainer_replenish}
                                                    onChange={(e) => setCustomField('retainer_replenish', e.target.value)}
                                                    className="h-10"
                                                />
                                                <p className="text-xs text-muted-foreground">Top up when balance falls below this amount.</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-medium">Fee notes</Label>
                                            <Textarea rows={2} className="resize-none text-sm"
                                                placeholder="e.g. Monthly retainer reviewed quarterly…"
                                                value={data.custom_fields.fee_notes}
                                                onChange={(e) => setCustomField('fee_notes', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* ── Court / Case details ── */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-foreground">Court &amp; Case Details <span className="font-normal text-muted-foreground">(optional)</span></h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="court" className="text-sm font-medium">Court / Tribunal</Label>
                                        <Input
                                            id="court"
                                            value={data.court}
                                            onChange={(e) => setData('court', e.target.value)}
                                            placeholder="e.g. Dublin Circuit Court"
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="court_reference" className="text-sm font-medium">Court reference number</Label>
                                        <Input
                                            id="court_reference"
                                            value={data.court_reference}
                                            onChange={(e) => setData('court_reference', e.target.value)}
                                            placeholder="e.g. 2025/1234"
                                            className="h-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4">
                                <Button type="button" variant="outline" asChild>
                                    <Link href={`/matters/${matter.id}`}>Cancel</Link>
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Saving…' : 'Save changes'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

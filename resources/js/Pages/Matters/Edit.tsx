import { Head, Link, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2 } from 'lucide-react';
import type { User, Contact, Matter } from '@/types';

interface Props {
    matter: Matter & { contacts: Contact[] };
    users: User[];
    contacts: Contact[];
}

export default function EditMatter({ matter, users, contacts }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        name: matter.name,
        description: matter.description || '',
        practice_area: matter.practice_area || '',
        fee_arrangement: matter.fee_arrangement || '',
        responsible_user_id: matter.responsible_user_id || '',
        contact_ids: matter.contacts?.map((c) => c.id) || [],
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/matters/${matter.id}`);
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
                                    rows={4}
                                    className="resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
                                            <SelectItem value="wills_probate">Wills & Probate</SelectItem>
                                            <SelectItem value="corporate">Corporate</SelectItem>
                                            <SelectItem value="immigration">Immigration</SelectItem>
                                            <SelectItem value="criminal">Criminal</SelectItem>
                                            <SelectItem value="personal_injury">Personal Injury</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.practice_area && <p className="text-xs text-destructive mt-1">{errors.practice_area}</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Fee arrangement *</Label>
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

                            <div className="flex gap-3 justify-end">
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

import { Head, Link, router, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Trash2 } from 'lucide-react';
import type { Contact } from '@/types';
import { CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from '@/lib/utils';

const SOURCE_DETAIL_LABELS: Record<string, { label: string; placeholder: string }> = {
    social_media:  { label: 'Platform', placeholder: 'e.g. LinkedIn, Facebook, Instagram…' },
    website:       { label: 'Landing page / campaign', placeholder: 'e.g. /contact, Google Ads campaign…' },
    friend_refer:  { label: 'Referred by', placeholder: 'Name of the person who referred them' },
    google:        { label: 'Search query / campaign', placeholder: 'e.g. "solicitor Dublin", Google Ads…' },
    referral:      { label: 'Referred by', placeholder: 'Name or organisation that referred them' },
    walk_in:       { label: 'Location / branch', placeholder: 'e.g. Main office, Cork branch…' },
    other:         { label: 'Details', placeholder: 'Please describe how they found us…' },
};

interface Props {
    contact: Contact;
}

export default function EditContact({ contact }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        type: contact.type,
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone || '',
        phone_secondary: (contact as any).phone_secondary || '',
        company_number: contact.company_number || '',
        contact_person_name: (contact as any).contact_person_name || '',
        contact_person_email: (contact as any).contact_person_email || '',
        contact_person_phone: (contact as any).contact_person_phone || '',
        dob: (contact as any).dob || '',
        address: {
            line1: (contact.address as any)?.line1 || '',
            line2: (contact.address as any)?.line2 || '',
            city: (contact.address as any)?.city || '',
            county: (contact.address as any)?.county || '',
            postcode: (contact.address as any)?.postcode || '',
        },
        lead_status: contact.lead_status || '',
        source: (contact as any).source || '',
        source_detail: (contact as any).source_detail || '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/contacts/${contact.id}`);
    };

    const handleDelete = () => {
        if (confirm('Are you sure you want to delete this contact?')) {
            router.delete(`/contacts/${contact.id}`);
        }
    };

    const updateAddress = (field: string, value: string) => {
        setData('address', { ...data.address, [field]: value });
    };

    return (
        <AppLayout title={`Edit ${contact.name}`}>
            <Head title={`Edit ${contact.name}`} />

            <div className="max-w-2xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href={`/contacts/${contact.id}`}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Contact
                        </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                </div>

                <Card className="surface-card">
                    <CardHeader className="pb-6">
                        <CardTitle className="text-xl tracking-tight">Edit Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <form onSubmit={submit} className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Contact Type *</Label>
                                <Select value={data.type} onValueChange={(v) => setData('type', v as typeof data.type)}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="individual">{CONTACT_TYPE_LABELS.individual}</SelectItem>
                                        <SelectItem value="company">{CONTACT_TYPE_LABELS.company}</SelectItem>
                                        <SelectItem value="other_party">{CONTACT_TYPE_LABELS.other_party}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
                                <Input
                                    id="name"
                                    autoFocus
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className="h-11"
                                />
                                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                            </div>

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div className="space-y-3">
                                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="h-11"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        className="h-11"
                                    />
                                </div>
                            </div>

                            {data.type === 'company' && (
                                <>
                                    <div className="space-y-3">
                                        <Label htmlFor="company_number" className="text-sm font-medium">Company Number</Label>
                                        <Input
                                            id="company_number"
                                            value={data.company_number}
                                            onChange={(e) => setData('company_number', e.target.value)}
                                            className="h-11"
                                        />
                                    </div>

                                    <div className="space-y-3 rounded-lg border border-border/60 p-4 bg-muted/20">
                                        <p className="text-sm font-semibold text-muted-foreground">Contact Person</p>
                                        <div className="space-y-3">
                                            <Label htmlFor="contact_person_name" className="text-sm font-medium">Name</Label>
                                            <Input
                                                id="contact_person_name"
                                                value={data.contact_person_name}
                                                onChange={(e) => setData('contact_person_name', e.target.value)}
                                                placeholder="Contact person's name"
                                                className="h-11"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="space-y-3">
                                                <Label htmlFor="contact_person_email" className="text-sm font-medium">Email</Label>
                                                <Input
                                                    id="contact_person_email"
                                                    type="email"
                                                    value={data.contact_person_email}
                                                    onChange={(e) => setData('contact_person_email', e.target.value)}
                                                    placeholder="contact@company.com"
                                                    className="h-11"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label htmlFor="contact_person_phone" className="text-sm font-medium">Phone</Label>
                                                <Input
                                                    id="contact_person_phone"
                                                    value={data.contact_person_phone}
                                                    onChange={(e) => setData('contact_person_phone', e.target.value)}
                                                    placeholder="+44 7700 900123"
                                                    className="h-11"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {data.type === 'individual' && (
                                <div className="space-y-3">
                                    <Label htmlFor="dob" className="text-sm font-medium">Date of Birth</Label>
                                    <Input
                                        id="dob"
                                        type="date"
                                        value={data.dob}
                                        onChange={(e) => setData('dob', e.target.value)}
                                        className="h-11"
                                    />
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Address</Label>
                                <Input
                                    value={data.address.line1}
                                    onChange={(e) => updateAddress('line1', e.target.value)}
                                    placeholder="Address Line 1"
                                    className="h-11 mb-2"
                                />
                                <Input
                                    value={data.address.line2}
                                    onChange={(e) => updateAddress('line2', e.target.value)}
                                    placeholder="Address Line 2"
                                    className="h-11 mb-2"
                                />
                                <div className="grid grid-cols-3 gap-2">
                                    <Input
                                        value={data.address.city}
                                        onChange={(e) => updateAddress('city', e.target.value)}
                                        placeholder="City"
                                        className="h-11"
                                    />
                                    <Input
                                        value={data.address.county}
                                        onChange={(e) => updateAddress('county', e.target.value)}
                                        placeholder="County"
                                        className="h-11"
                                    />
                                    <Input
                                        value={data.address.postcode}
                                        onChange={(e) => updateAddress('postcode', e.target.value)}
                                        placeholder="Postcode"
                                        className="h-11"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Lead Status</Label>
                                <Select value={data.lead_status} onValueChange={(v) => setData('lead_status', v)}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="enquiry">Enquiry</SelectItem>
                                        <SelectItem value="consultation_booked">Consultation Booked</SelectItem>
                                        <SelectItem value="engaged">Engaged</SelectItem>
                                        <SelectItem value="matter_opened">Matter Opened</SelectItem>
                                        <SelectItem value="declined">Declined</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Source</Label>
                                <Select value={data.source} onValueChange={(v) => { setData('source', v); setData('source_detail', ''); }}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="social_media">Social Media</SelectItem>
                                        <SelectItem value="website">Website</SelectItem>
                                        <SelectItem value="friend_refer">Friend Referral</SelectItem>
                                        <SelectItem value="google">Google</SelectItem>
                                        <SelectItem value="referral">Referral</SelectItem>
                                        <SelectItem value="walk_in">Walk-in</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                {data.source && SOURCE_DETAIL_LABELS[data.source] && (
                                    <div className="space-y-1">
                                        <Label className="text-sm font-medium">
                                            {SOURCE_DETAIL_LABELS[data.source].label}
                                        </Label>
                                        <Input
                                            value={data.source_detail}
                                            onChange={(e) => setData('source_detail', e.target.value)}
                                            placeholder={SOURCE_DETAIL_LABELS[data.source].placeholder}
                                            className="h-10"
                                        />
                                    </div>
                                )}
                            </div>

                            <Separator />

                            <div className="flex gap-3 justify-end">
                                <Button type="button" variant="outline" asChild>
                                    <Link href={`/contacts/${contact.id}`}>Cancel</Link>
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

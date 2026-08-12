import { Head, Link, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS, PREFIX_OPTIONS } from '@/lib/utils';

const SOURCE_DETAIL_LABELS: Record<string, { label: string; placeholder: string }> = {
    social_media:  { label: 'Platform', placeholder: 'e.g. LinkedIn, Facebook, Instagram…' },
    website:       { label: 'Landing page / campaign', placeholder: 'e.g. /contact, Google Ads campaign…' },
    friend_refer:  { label: 'Referred by', placeholder: 'Name of the person who referred them' },
    google:        { label: 'Search query / campaign', placeholder: 'e.g. "solicitor Dublin", Google Ads…' },
    referral:      { label: 'Referred by', placeholder: 'Name or organisation that referred them' },
    walk_in:       { label: 'Location / branch', placeholder: 'e.g. Main office, Cork branch…' },
    other:         { label: 'Details', placeholder: 'Please describe how they found us…' },
};

export default function CreateContact() {
    const { data, setData, post, processing, errors } = useForm({
        type: 'individual',
        prefix: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        name: '',
        email: '',
        phone: '',
        phone_secondary: '',
        company_number: '',
        contact_person_name: '',
        contact_person_email: '',
        contact_person_phone: '',
        dob: '',
        address: {
            line1: '',
            line2: '',
            city: '',
            county: '',
            postcode: '',
            country: '',
        },
        lead_status: '',
        source: '',
        source_detail: '',
    });

    const composeName = (prefix: string, first: string, middle: string, last: string, type: string) => {
        if (type === 'company') return '';
        return [prefix, first, middle, last].filter(Boolean).join(' ');
    };

    const handleFieldChange = (field: string, value: string) => {
        setData(field as any, value);
        if (['prefix', 'first_name', 'middle_name', 'last_name'].includes(field)) {
            const updated = { prefix: data.prefix, first_name: data.first_name, middle_name: data.middle_name, last_name: data.last_name, [field]: value };
            setData('name', composeName(updated.prefix, updated.first_name, updated.middle_name, updated.last_name, data.type));
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/contacts');
    };

    const updateAddress = (field: string, value: string) => {
        setData('address', { ...data.address, [field]: value });
    };

    const isIndividual = data.type === 'individual' || data.type === 'other_party';

    return (
        <AppLayout title="New Contact">
            <Head title="New Contact" />

            <div className="max-w-2xl mx-auto">
                <div className="mb-8">
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <Link href="/contacts">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Contacts
                        </Link>
                    </Button>
                </div>

                <Card className="surface-card">
                    <CardHeader className="pb-6">
                        <CardTitle className="text-xl tracking-tight">Add New Contact</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <form onSubmit={submit} className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Contact Type *</Label>
                                <Select value={data.type} onValueChange={(v) => {
                                    setData('type', v);
                                    if (v === 'company') {
                                        setData('prefix', '');
                                        setData('first_name', '');
                                        setData('middle_name', '');
                                        setData('last_name', '');
                                    }
                                }}>
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

                            {isIndividual ? (
                                <>
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium">Prefix</Label>
                                            <Select value={data.prefix} onValueChange={(v) => handleFieldChange('prefix', v)}>
                                                <SelectTrigger className="h-11">
                                                    <SelectValue placeholder="—" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {PREFIX_OPTIONS.map((p) => (
                                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-3 col-span-3">
                                            <Label htmlFor="first_name" className="text-sm font-medium">First Name *</Label>
                                            <Input
                                                id="first_name"
                                                autoFocus
                                                value={data.first_name}
                                                onChange={(e) => handleFieldChange('first_name', e.target.value)}
                                                placeholder="John"
                                                className="h-11"
                                            />
                                            {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name}</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-3">
                                            <Label htmlFor="middle_name" className="text-sm font-medium">Middle Name</Label>
                                            <Input
                                                id="middle_name"
                                                value={data.middle_name}
                                                onChange={(e) => handleFieldChange('middle_name', e.target.value)}
                                                placeholder="Michael"
                                                className="h-11"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <Label htmlFor="last_name" className="text-sm font-medium">Last Name *</Label>
                                            <Input
                                                id="last_name"
                                                value={data.last_name}
                                                onChange={(e) => handleFieldChange('last_name', e.target.value)}
                                                placeholder="Smith"
                                                className="h-11"
                                            />
                                            {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name}</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Full Name (auto-generated)</Label>
                                        <p className="text-sm font-medium text-foreground/80 bg-muted/30 rounded-md px-3 py-2">
                                            {data.name || '—'}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-3">
                                    <Label htmlFor="name" className="text-sm font-medium">Company Name *</Label>
                                    <Input
                                        id="name"
                                        autoFocus
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="Company Ltd"
                                        className="h-11"
                                    />
                                    {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div className="space-y-3">
                                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="email@example.com"
                                        className="h-11"
                                    />
                                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        placeholder="+44 7700 900123"
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
                                            placeholder="123456"
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
                                <Input
                                    value={data.address.country}
                                    onChange={(e) => updateAddress('country', e.target.value)}
                                    placeholder="Country"
                                    className="h-11"
                                />
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

                            <div className="flex gap-3 justify-end pt-6">
                                <Button type="button" variant="outline" asChild>
                                    <Link href="/contacts">Cancel</Link>
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Creating…' : 'Create Contact'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

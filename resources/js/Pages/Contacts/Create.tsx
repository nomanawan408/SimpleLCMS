import { Head, Link, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';

export default function CreateContact() {
    const { data, setData, post, processing, errors } = useForm({
        type: 'individual',
        name: '',
        email: '',
        phone: '',
        phone_secondary: '',
        company_number: '',
        dob: '',
        address: {
            line1: '',
            line2: '',
            city: '',
            county: '',
            postcode: '',
        },
        lead_status: '',
        source: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/contacts');
    };

    const updateAddress = (field: string, value: string) => {
        setData('address', { ...data.address, [field]: value });
    };

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
                                <Select value={data.type} onValueChange={(v) => setData('type', v)}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="individual">Individual</SelectItem>
                                        <SelectItem value="company">Company</SelectItem>
                                        <SelectItem value="other_party">Other Party</SelectItem>
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
                                    placeholder={data.type === 'company' ? 'Company Ltd' : 'John Smith'}
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
                            )}

                            {data.type === 'individual' && (
                                <>
                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div className="space-y-3">
                                        </div>

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
                                    </div>
                                </>
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
                                <Select value={data.source} onValueChange={(v) => setData('source', v)}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="social_media">Social Media</SelectItem>
                                        <SelectItem value="website">Website</SelectItem>
                                        <SelectItem value="friend_refer">Friend Refer</SelectItem>
                                        <SelectItem value="google">Google</SelectItem>
                                        <SelectItem value="referral">Referral</SelectItem>
                                        <SelectItem value="walk_in">Walk-in</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-3 justify-end pt-6">
                                <Button type="button" variant="outline" asChild>
                                    <Link href="/contacts">Cancel</Link>
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Creating...' : 'Create Contact'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

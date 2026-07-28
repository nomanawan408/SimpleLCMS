import { Head, useForm } from '@inertiajs/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, CreditCard, KeyRound, MapPin } from 'lucide-react';

interface Firm {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
}

interface Props {
    firm: Firm;
    token: string;
}

export default function FirmSetupComplete({ firm, token }: Props) {
    const { data, setData, put, processing, errors, recentlySuccessful } = useForm({
        password: '',
        password_confirmation: '',
        vat_number: '',
        sra_number: '',
        website: '',
        address_line1: '',
        address_line2: '',
        city: '',
        county: '',
        postcode: '',
        default_hourly_rate: 250,
        vat_rate: 20,
        invoice_prefix: 'INV',
        payment_terms_days: 30,
        bank_name: '',
        bank_sort_code: '',
        bank_account_number: '',
        bank_account_name: '',
        bank_iban: '',
        bank_swift_code: '',
        payment_instructions: '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/firm/setup/${token}`);
    };

    return (
        <div className="min-h-screen bg-background">
            <Head title="Complete Firm Setup" />

            {/* Header */}
            <div className="border-b border-border bg-card">
                <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                        SL
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Complete Your Firm Setup</h1>
                        <p className="text-sm text-muted-foreground">{firm.name}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm text-foreground">
                        Welcome! Please complete your firm profile below. You can add your office address, billing defaults, and bank details. Fields marked with * are required.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-6">
                    {/* Set Password */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <KeyRound className="h-4 w-4" />
                                Set Your Password
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">Choose a password to log in to your firm admin account.</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password *</Label>
                                <Input id="password" type="password" value={data.password} onChange={(e) => setData('password', e.target.value)} autoComplete="new-password" />
                                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password_confirmation">Confirm password *</Label>
                                <Input id="password_confirmation" type="password" value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} autoComplete="new-password" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Office Address */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                Office Address
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="address_line1">Address line 1</Label>
                                <Input id="address_line1" value={data.address_line1} onChange={(e) => setData('address_line1', e.target.value)} />
                                {errors.address_line1 && <p className="text-xs text-destructive">{errors.address_line1}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address_line2">Address line 2</Label>
                                <Input id="address_line2" value={data.address_line2} onChange={(e) => setData('address_line2', e.target.value)} />
                                {errors.address_line2 && <p className="text-xs text-destructive">{errors.address_line2}</p>}
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city">City</Label>
                                    <Input id="city" value={data.city} onChange={(e) => setData('city', e.target.value)} />
                                    {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="county">County</Label>
                                    <Input id="county" value={data.county} onChange={(e) => setData('county', e.target.value)} />
                                    {errors.county && <p className="text-xs text-destructive">{errors.county}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="postcode">Postcode</Label>
                                    <Input id="postcode" value={data.postcode} onChange={(e) => setData('postcode', e.target.value)} />
                                    {errors.postcode && <p className="text-xs text-destructive">{errors.postcode}</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Professional Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Professional Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="vat_number">VAT number</Label>
                                    <Input id="vat_number" value={data.vat_number} onChange={(e) => setData('vat_number', e.target.value)} placeholder="GB123456789" />
                                    {errors.vat_number && <p className="text-xs text-destructive">{errors.vat_number}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sra_number">SRA Number</Label>
                                    <Input id="sra_number" value={data.sra_number} onChange={(e) => setData('sra_number', e.target.value)} />
                                    {errors.sra_number && <p className="text-xs text-destructive">{errors.sra_number}</p>}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="website">Website</Label>
                                <Input id="website" type="url" value={data.website} onChange={(e) => setData('website', e.target.value)} placeholder="https://www.lawfirm.co.uk" />
                                {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Billing Defaults */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Billing Defaults
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="default_hourly_rate">Default hourly rate (£)</Label>
                                    <Input
                                        id="default_hourly_rate"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={data.default_hourly_rate}
                                        onChange={(e) => setData('default_hourly_rate', parseFloat(e.target.value))}
                                    />
                                    {errors.default_hourly_rate && <p className="text-xs text-destructive">{errors.default_hourly_rate}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="vat_rate">VAT rate (%)</Label>
                                    <Input
                                        id="vat_rate"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={data.vat_rate}
                                        onChange={(e) => setData('vat_rate', parseFloat(e.target.value))}
                                    />
                                    {errors.vat_rate && <p className="text-xs text-destructive">{errors.vat_rate}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="invoice_prefix">Invoice prefix</Label>
                                    <Input
                                        id="invoice_prefix"
                                        value={data.invoice_prefix}
                                        onChange={(e) => setData('invoice_prefix', e.target.value)}
                                        placeholder="INV"
                                        maxLength={10}
                                    />
                                    {errors.invoice_prefix && <p className="text-xs text-destructive">{errors.invoice_prefix}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
                                    <Input
                                        id="payment_terms_days"
                                        type="number"
                                        min="0"
                                        value={data.payment_terms_days}
                                        onChange={(e) => setData('payment_terms_days', parseInt(e.target.value))}
                                    />
                                    {errors.payment_terms_days && <p className="text-xs text-destructive">{errors.payment_terms_days}</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bank Account */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Bank Account (for receiving payments)</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">These details will appear on invoices sent to clients for manual bank transfer payments.</p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bank_name">Bank name</Label>
                                    <Input id="bank_name" value={data.bank_name} onChange={(e) => setData('bank_name', e.target.value)} placeholder="Barclays Bank PLC" />
                                    {errors.bank_name && <p className="text-xs text-destructive">{errors.bank_name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_account_name">Account name</Label>
                                    <Input id="bank_account_name" value={data.bank_account_name} onChange={(e) => setData('bank_account_name', e.target.value)} placeholder="Smith & Jones LLP Client Account" />
                                    {errors.bank_account_name && <p className="text-xs text-destructive">{errors.bank_account_name}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bank_sort_code">Sort code</Label>
                                    <Input id="bank_sort_code" value={data.bank_sort_code} onChange={(e) => setData('bank_sort_code', e.target.value)} placeholder="20-45-67" />
                                    {errors.bank_sort_code && <p className="text-xs text-destructive">{errors.bank_sort_code}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_account_number">Account number</Label>
                                    <Input id="bank_account_number" value={data.bank_account_number} onChange={(e) => setData('bank_account_number', e.target.value)} placeholder="12345678" />
                                    {errors.bank_account_number && <p className="text-xs text-destructive">{errors.bank_account_number}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bank_iban">IBAN</Label>
                                    <Input id="bank_iban" value={data.bank_iban} onChange={(e) => setData('bank_iban', e.target.value)} placeholder="GB29 BARC 2045 6712 3456 78" />
                                    {errors.bank_iban && <p className="text-xs text-destructive">{errors.bank_iban}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_swift_code">SWIFT / BIC code</Label>
                                    <Input id="bank_swift_code" value={data.bank_swift_code} onChange={(e) => setData('bank_swift_code', e.target.value)} placeholder="BARCGB22" />
                                    {errors.bank_swift_code && <p className="text-xs text-destructive">{errors.bank_swift_code}</p>}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payment_instructions">Payment instructions / reference note</Label>
                                <Textarea
                                    id="payment_instructions"
                                    rows={3}
                                    value={data.payment_instructions}
                                    onChange={(e) => setData('payment_instructions', e.target.value)}
                                    placeholder="Please use the invoice number as the payment reference."
                                />
                                {errors.payment_instructions && <p className="text-xs text-destructive">{errors.payment_instructions}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between pb-8">
                        {recentlySuccessful && (
                            <p className="text-sm text-green-600">Setup complete! Redirecting to login…</p>
                        )}
                        <Button type="submit" disabled={processing} className="ml-auto">
                            {processing ? 'Saving…' : 'Complete Setup'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

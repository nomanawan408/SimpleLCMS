import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import type { Firm } from '@/types';

interface Props {
    firm: Firm;
}

export default function FirmSetup({ firm }: Props) {
    const { data, setData, put, processing, errors, recentlySuccessful } = useForm({
        name: firm.name ?? '',
        vat_number: firm.vat_number ?? '',
        sra_number: firm.sra_number ?? '',
        email: firm.email ?? '',
        phone: firm.phone ?? '',
        website: firm.website ?? '',
        address_line1: firm.address_line1 ?? '',
        address_line2: firm.address_line2 ?? '',
        city: firm.city ?? '',
        county: firm.county ?? '',
        postcode: firm.postcode ?? '',
        default_hourly_rate: firm.default_hourly_rate ?? 250,
        vat_rate: firm.vat_rate ?? 20,
        invoice_prefix: firm.invoice_prefix ?? 'INV',
        payment_terms_days: firm.payment_terms_days ?? 30,
        bank_name: (firm as any).bank_name ?? '',
        bank_sort_code: (firm as any).bank_sort_code ?? '',
        bank_account_number: (firm as any).bank_account_number ?? '',
        bank_account_name: (firm as any).bank_account_name ?? '',
        bank_iban: (firm as any).bank_iban ?? '',
        bank_swift_code: (firm as any).bank_swift_code ?? '',
        payment_instructions: (firm as any).payment_instructions ?? '',
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        put('/admin/firm');
    };

    return (
        <AppLayout title="Firm Setup">
            <Head title="Firm Setup" />

            <div className="max-w-2xl mx-auto space-y-6">
                <form onSubmit={submit} className="space-y-6">
                    {/* Basic Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Firm Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Firm name *</Label>
                                <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} />
                                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="vat_number">VAT number *</Label>
                                    <Input id="vat_number" value={data.vat_number} onChange={(e) => setData('vat_number', e.target.value)} placeholder="GB123456789" />
                                    {errors.vat_number && <p className="text-xs text-destructive">{errors.vat_number}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="sra_number">SRA Number</Label>
                                    <Input id="sra_number" value={data.sra_number} onChange={(e) => setData('sra_number', e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Contact email</Label>
                                    <Input id="email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input id="phone" value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="+44 20 7946 0958" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="website">Website</Label>
                                <Input id="website" type="url" value={data.website} onChange={(e) => setData('website', e.target.value)} placeholder="https://www.lawfirm.co.uk" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Address */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Office Address</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="address_line1">Address line 1</Label>
                                <Input id="address_line1" value={data.address_line1} onChange={(e) => setData('address_line1', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address_line2">Address line 2</Label>
                                <Input id="address_line2" value={data.address_line2} onChange={(e) => setData('address_line2', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city">City</Label>
                                    <Input id="city" value={data.city} onChange={(e) => setData('city', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="county">County</Label>
                                    <Input id="county" value={data.county} onChange={(e) => setData('county', e.target.value)} placeholder="Greater London" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="postcode">Postcode</Label>
                                    <Input id="postcode" value={data.postcode} onChange={(e) => setData('postcode', e.target.value)} placeholder="EC1A 1BB" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Billing Defaults */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Billing Defaults</CardTitle>
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
                                    <Input
                                        id="bank_name"
                                        value={data.bank_name}
                                        onChange={(e) => setData('bank_name', e.target.value)}
                                        placeholder="Barclays Bank PLC"
                                    />
                                    {errors.bank_name && <p className="text-xs text-destructive">{errors.bank_name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_account_name">Account name</Label>
                                    <Input
                                        id="bank_account_name"
                                        value={data.bank_account_name}
                                        onChange={(e) => setData('bank_account_name', e.target.value)}
                                        placeholder="Smith & Jones LLP Client Account"
                                    />
                                    {errors.bank_account_name && <p className="text-xs text-destructive">{errors.bank_account_name}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bank_sort_code">Sort code</Label>
                                    <Input
                                        id="bank_sort_code"
                                        value={data.bank_sort_code}
                                        onChange={(e) => setData('bank_sort_code', e.target.value)}
                                        placeholder="20-45-67"
                                    />
                                    {errors.bank_sort_code && <p className="text-xs text-destructive">{errors.bank_sort_code}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_account_number">Account number</Label>
                                    <Input
                                        id="bank_account_number"
                                        value={data.bank_account_number}
                                        onChange={(e) => setData('bank_account_number', e.target.value)}
                                        placeholder="12345678"
                                    />
                                    {errors.bank_account_number && <p className="text-xs text-destructive">{errors.bank_account_number}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bank_iban">IBAN</Label>
                                    <Input
                                        id="bank_iban"
                                        value={data.bank_iban}
                                        onChange={(e) => setData('bank_iban', e.target.value)}
                                        placeholder="GB29 BARC 2045 6712 3456 78"
                                    />
                                    {errors.bank_iban && <p className="text-xs text-destructive">{errors.bank_iban}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bank_swift_code">SWIFT / BIC code</Label>
                                    <Input
                                        id="bank_swift_code"
                                        value={data.bank_swift_code}
                                        onChange={(e) => setData('bank_swift_code', e.target.value)}
                                        placeholder="BARCGB22"
                                    />
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
                                    placeholder="Please use the invoice number as the payment reference. Payments are typically processed within 2 business days."
                                />
                                {errors.payment_instructions && <p className="text-xs text-destructive">{errors.payment_instructions}</p>}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between">
                        {recentlySuccessful && (
                            <p className="text-sm text-green-600">Saved successfully.</p>
                        )}
                        <Button type="submit" disabled={processing} className="ml-auto">
                            {processing ? 'Saving…' : 'Save changes'}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}

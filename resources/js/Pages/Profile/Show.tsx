import { Head, router, useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { initials } from '@/lib/utils';
import { Camera, Trash2 } from 'lucide-react';

interface Props {
    profileUser: {
        id: string;
        full_name: string;
        email: string;
        avatar_url: string | null;
    };
}

export default function ProfileShow({ profileUser }: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const form = useForm<{ avatar: File | null }>({ avatar: null });

    const pickFile = (files: FileList | null) => {
        const file = files?.[0] ?? null;
        form.setData('avatar', file);
        form.clearErrors('avatar');
        if (preview) URL.revokeObjectURL(preview);
        setPreview(file ? URL.createObjectURL(file) : null);
        // Without this, choosing the exact same file again fires no change event.
        if (fileRef.current) fileRef.current.value = '';
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.data.avatar) return;
        form.post('/profile/avatar', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
            },
        });
    };

    const remove = () => {
        if (!profileUser.avatar_url || form.processing) return;
        if (!confirm('Remove your profile picture?')) return;
        router.delete('/profile/avatar', { preserveScroll: true });
    };

    const shownSrc = preview ?? profileUser.avatar_url ?? undefined;

    return (
        <AppLayout title="Profile">
            <Head title="Profile" />

            <div className="mx-auto max-w-lg">
                <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage your profile picture. It appears in the header and alongside your name.
                </p>

                <Card className="mt-6 rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-5">
                            <Avatar className="h-24 w-24 shrink-0 ring-1 ring-border">
                                <AvatarImage src={shownSrc} alt={profileUser.full_name} />
                                <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                                    {initials(profileUser.full_name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-foreground">{profileUser.full_name}</p>
                                <p className="truncate text-sm text-muted-foreground">{profileUser.email}</p>
                                <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP · max 2 MB</p>
                            </div>
                        </div>

                        <form onSubmit={submit} className="mt-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="avatar">New picture</Label>
                                <Input
                                    id="avatar"
                                    ref={fileRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => pickFile(e.target.files)}
                                />
                                {form.errors.avatar && (
                                    <p className="text-xs text-destructive">{form.errors.avatar}</p>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="submit" disabled={!form.data.avatar || form.processing} className="gap-2">
                                    <Camera className="h-4 w-4" />
                                    {form.processing ? 'Uploading…' : 'Upload picture'}
                                </Button>
                                {profileUser.avatar_url && (
                                    <Button type="button" variant="outline" onClick={remove} disabled={form.processing} className="gap-2 text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                        Remove
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}

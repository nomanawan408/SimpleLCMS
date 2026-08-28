<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Mail\FirmSetupInviteMail;
use App\Models\Document;
use App\Models\Firm;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Inertia\Inertia;
use Inertia\Response;

class FirmController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $firms = Firm::withCount(['users', 'matters'])
            ->orderBy('created_at', 'desc')
            ->get();

        return Inertia::render('SuperAdmin/Firms/Index', [
            // Every field the edit dialog can write must be sent back, or
            // saving an edit resets the ones it never received.
            'firms' => $firms->map(fn ($firm) => [
                'id'                  => $firm->id,
                'name'                => $firm->name,
                'slug'                => $firm->slug,
                'plan'                => $firm->plan,
                'subscription_status' => $firm->subscription_status,
                'trial_ends_at'       => $firm->trial_ends_at,
                'email'               => $firm->email,
                'phone'               => $firm->phone,
                'address_line1'       => $firm->address_line1,
                'city'                => $firm->city,
                'postcode'            => $firm->postcode,
                'timezone'            => $firm->timezone,
                'default_hourly_rate' => $firm->default_hourly_rate,
                'vat_rate'            => $firm->vat_rate,
                'users_count'         => $firm->users_count,
                'matters_count'       => $firm->matters_count,
                'created_at'          => $firm->created_at,
            ]),
        ]);
    }

    public function show(Request $request, Firm $firm): Response
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $firm->loadCount(['users', 'matters']);
        $firm->load(['users' => fn ($q) => $q->orderBy('full_name')]);

        return Inertia::render('SuperAdmin/Firms/Show', [
            'firm' => $firm,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $validated = $request->validate([
            'name'               => ['required', 'string', 'max:255'],
            'slug'               => ['required', 'string', 'max:255', 'unique:firms,slug'],
            'email'              => ['nullable', 'email', 'max:255'],
            'phone'              => ['nullable', 'string', 'max:50'],
            'plan'               => ['required', 'in:starter,professional,enterprise'],
            'subscription_status'=> ['required', 'in:trial,active,past_due,cancelled'],
            'trial_ends_at'      => ['nullable', 'date'],
            'address_line1'      => ['nullable', 'string', 'max:255'],
            'city'               => ['nullable', 'string', 'max:100'],
            'postcode'           => ['nullable', 'string', 'max:20'],
            'timezone'           => ['nullable', 'string', 'max:50'],
            'default_hourly_rate'=> ['nullable', 'numeric', 'min:0'],
            'vat_rate'           => ['nullable', 'numeric', 'min:0', 'max:100'],
            // Admin person details
            'admin_name'         => ['required', 'string', 'max:255'],
            'admin_email'        => ['required', 'email', 'max:255', 'unique:users,email'],
        ]);

        $setupToken = Str::random(64);

        DB::transaction(function () use ($validated, $setupToken, &$firm, &$admin) {
            $firm = Firm::create([
                'name'               => $validated['name'],
                'slug'               => $validated['slug'],
                'email'              => $validated['email'] ?? null,
                'phone'              => $validated['phone'] ?? null,
                'plan'               => $validated['plan'],
                'subscription_status'=> $validated['subscription_status'],
                'trial_ends_at'      => $validated['trial_ends_at'] ?? null,
                'address_line1'      => $validated['address_line1'] ?? null,
                'city'               => $validated['city'] ?? null,
                'postcode'           => $validated['postcode'] ?? null,
                'timezone'           => $validated['timezone'] ?? 'Europe/London',
                'default_hourly_rate'=> $validated['default_hourly_rate'] ?? 250,
                'vat_rate'           => $validated['vat_rate'] ?? 20,
                'invoice_prefix'     => strtoupper(Str::substr($validated['name'], 0, 3)),
                'invoice_sequence'   => 1,
                'payment_terms_days' => 30,
                'setup_token'        => $setupToken,
                'setup_token_expires_at' => now()->addHours(72),
            ]);

            $tempPassword = Str::random(12);
            $admin = User::create([
                'firm_id'            => $firm->id,
                'full_name'          => $validated['admin_name'],
                'email'              => $validated['admin_email'],
                'password'           => Hash::make($tempPassword),
                'role'               => 'firm_admin',
                'is_active'          => true,
                'email_verified_at'  => now(),
            ]);
            $admin->syncRoles(['firm_admin']);
        });

        // Send setup invitation email
        $setupUrl = url("/firm/setup/{$setupToken}");
        try {
            Mail::to($validated['admin_email'])
                ->send(new FirmSetupInviteMail($firm, $validated['admin_name'], $validated['admin_email'], $setupUrl));
        } catch (\Exception $e) {
            // Email failed but firm was created — log and continue
        }

        activity()->causedBy($request->user())->performedOn($firm)->log('firm_created');

        return redirect()->route('superadmin.firms.index')
            ->with('success', "Firm '{$firm->name}' created. Setup link sent to {$validated['admin_email']}.");
    }

    public function update(Request $request, Firm $firm): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $validated = $request->validate([
            'name'               => ['sometimes', 'string', 'max:255'],
            'plan'               => ['sometimes', 'in:starter,professional,enterprise'],
            'subscription_status'=> ['sometimes', 'in:trial,active,past_due,cancelled'],
            'trial_ends_at'      => ['nullable', 'date'],
            'email'              => ['nullable', 'email', 'max:255'],
            'phone'              => ['nullable', 'string', 'max:50'],
            'address_line1'      => ['nullable', 'string', 'max:255'],
            'city'               => ['nullable', 'string', 'max:100'],
            'postcode'           => ['nullable', 'string', 'max:20'],
            'timezone'           => ['nullable', 'string', 'max:50'],
            'default_hourly_rate'=> ['nullable', 'numeric', 'min:0'],
            'vat_rate'           => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $firm->update($validated);

        activity()->causedBy($request->user())->performedOn($firm)->log('firm_updated');

        return back()->with('success', "Firm '{$firm->name}' updated.");
    }

    public function destroy(Request $request, Firm $firm): RedirectResponse
    {
        abort_unless($request->user()->hasRole('super_admin'), 403);

        $firmName = $firm->name;
        $firmId = $firm->id;

        // Record what is about to be destroyed, while it still exists.
        $counts = [
            'users' => $firm->users()->count(),
            'matters' => $firm->matters()->count(),
            'contacts' => $firm->contacts()->count(),
        ];

        // Documents cascade out of the database but their files do not, so
        // they would sit in storage forever.
        $documentKeys = Document::withoutGlobalScope('firm')
            ->withTrashed()
            ->where('firm_id', $firmId)
            ->pluck('s3_key')
            ->filter()
            ->all();

        DB::transaction(function () use ($firm, $firmId) {
            // roles.firm_id is nullOnDelete, and a null firm_id now marks a
            // role as platform-wide. Without this, deleting a firm would hand
            // its private roles to every other firm on the platform.
            $roles = Role::where('firm_id', $firmId)->get();
            foreach ($roles as $role) {
                $role->users()->detach();
                $role->delete();
            }

            $firm->users()->forceDelete();
            $firm->delete();
        });

        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach ($documentKeys as $key) {
            if (Storage::disk('local')->exists($key)) {
                Storage::disk('local')->delete($key);
            }
        }

        activity()->causedBy($request->user())
            ->withProperties(['firm_id' => $firmId, 'firm_name' => $firmName] + $counts)
            ->log('firm_deleted');

        return redirect()->route('superadmin.firms.index')
            ->with('success', "Firm '{$firmName}' and all its data deleted.");
    }
}

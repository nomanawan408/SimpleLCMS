<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Matter;
use App\Models\TimeEntry;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class TimeController extends Controller
{
    public function index(Request $request): Response
    {
        $user   = $request->user();
        $firmId = $user->firm_id;
        $canManageAll = $user->hasPermissionTo('manage_time_entries');

        $query = TimeEntry::where('firm_id', $firmId)
            ->with(['matter', 'user'])
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc');

        if (!$canManageAll) {
            $query->where('user_id', $user->id);
        }

        if ($request->filled('matter_id'))    $query->where('matter_id', $request->matter_id);
        if ($request->filled('user_id'))      $query->where('user_id', $request->user_id);
        if ($request->filled('date_from'))    $query->where('date', '>=', $request->date_from);
        if ($request->filled('date_to'))      $query->where('date', '<=', $request->date_to);
        if ($request->filled('billable'))     $query->where('billable', $request->billable === '1');
        if ($request->filled('billed'))       $query->where('billed', $request->billed === '1');
        if ($request->filled('activity_type')) $query->where('activity_type', $request->activity_type);
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'ilike', "%{$search}%")
                  ->orWhereHas('matter', fn ($mq) => $mq->where('name', 'ilike', "%{$search}%"));
            });
        }

        $entries = $query->paginate(25)->withQueryString();
        $entries->getCollection()->each(function ($entry) {
            $entry->matter?->setAppends([]);
        });

        $statsBase = TimeEntry::where('firm_id', $firmId);
        if (!$canManageAll) {
            $statsBase->where('user_id', $user->id);
        }

        $todayMinutes    = (int) (clone $statsBase)->whereDate('date', today())->sum('duration_minutes');
        $weekMinutes     = (int) (clone $statsBase)->whereBetween('date', [now()->startOfWeek(), now()->endOfWeek()])->sum('duration_minutes');
        $unbilledMinutes = (int) (clone $statsBase)->where('billable', true)->where('billed', false)->sum('duration_minutes');

        $stats = [
            'hours_today'          => (float) round($todayMinutes / 60, 2),
            'hours_week'           => (float) round($weekMinutes / 60, 2),
            'unbilled_hours'       => (float) round($unbilledMinutes / 60, 2),
            'unbilled_amount'      => (float) (clone $statsBase)->where('billable', true)->where('billed', false)->sum('amount'),
            'today_minutes'        => $todayMinutes,
            'week_minutes'         => $weekMinutes,
            'unbilled_minutes'     => $unbilledMinutes,
            'entries_today'        => (int) (clone $statsBase)->whereDate('date', today())->count(),
        ];

        $timerKey   = 'active_timer_' . $user->id;
        $activeTimer = session($timerKey);

        return Inertia::render('Time/Index', [
            'entries'     => $entries,
            'stats'       => $stats,
            'users'       => User::where('firm_id', $firmId)->where('is_active', true)->get(['id', 'full_name', 'rate_per_hour']),
            'matters'     => Matter::where('firm_id', $firmId)->whereNotIn('status', ['closed', 'archived'])->orderBy('name')->get(['id', 'name', 'matter_number', 'custom_fields', 'fee_arrangement'])->each(fn ($m) => $m->setAppends([])),
            'filters'     => $request->only('matter_id', 'user_id', 'billable', 'billed', 'date_from', 'date_to', 'activity_type', 'search'),
            'activeTimer' => $activeTimer,
            'defaultRate' => (float) ($user->rate_per_hour ?? $user->firm->default_hourly_rate ?? 0),
            'firmVatRate' => (float) ($user->firm->vat_rate ?? 0),
            'isAdmin'     => $canManageAll,
        ]);
    }

    public function store(Request $request): SymfonyResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'matter_id'        => ['required', 'uuid', 'exists:matters,id'],
            'date'             => ['required', 'date'],
            'duration_minutes' => ['required', 'integer', 'min:1'],
            'rate'             => ['nullable', 'numeric', 'min:0'],
            'billable'         => ['boolean'],
            'activity_type'    => ['nullable', 'in:advising,drafting,research,court_attendance,travel,telephone,correspondence,meeting,other'],
            'description'      => ['nullable', 'string', 'max:1000'],
        ]);

        $matter = Matter::where('id', $validated['matter_id'])->where('firm_id', $user->firm_id)->firstOrFail();

        $matterRate = is_array($matter->custom_fields) ? ($matter->custom_fields['hourly_rate'] ?? null) : null;
        $rate       = $validated['rate'] ?? ($matterRate !== null && $matterRate !== '' ? (float) $matterRate : ($user->rate_per_hour ?? $user->firm->default_hourly_rate ?? 0));
        $amount = round(((float) $rate) * ($validated['duration_minutes'] / 60), 2);

        $entry = TimeEntry::create([
            'firm_id'          => $user->firm_id,
            'matter_id'        => $matter->id,
            'user_id'          => $user->id,
            'invoice_id'       => null,
            'date'             => $validated['date'],
            'duration_minutes' => (int) $validated['duration_minutes'],
            'rate'             => (float) $rate,
            'amount'           => $amount,
            'billable'         => (bool) ($validated['billable'] ?? true),
            'billed'           => false,
            'activity_type'    => $validated['activity_type'] ?? 'other',
            'description'      => $validated['description'] ?? null,
            'is_locked'        => false,
        ]);

        activity()->causedBy($user)->performedOn($entry)->log('time_logged');

        if ($request->expectsJson()) {
            return response()->json(['entry' => $entry->load(['matter', 'user'])]);
        }

        return back()->with('success', 'Time entry logged.');
    }

    public function update(Request $request, TimeEntry $entry): SymfonyResponse
    {
        if ($entry->firm_id !== $request->user()->firm_id) abort(403);

        if ($entry->is_locked || $entry->billed) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Entry is locked or already billed.'], 422);
            }
            return back()->with('error', 'This entry is locked or already billed.');
        }

        $validated = $request->validate([
            'date'             => ['sometimes', 'required', 'date'],
            'duration_minutes' => ['sometimes', 'required', 'integer', 'min:1'],
            'rate'             => ['nullable', 'numeric', 'min:0'],
            'billable'         => ['boolean'],
            'activity_type'    => ['nullable', 'in:advising,drafting,research,court_attendance,travel,telephone,correspondence,meeting,other'],
            'description'      => ['nullable', 'string', 'max:1000'],
        ]);

        $rate = array_key_exists('rate', $validated) ? ($validated['rate'] ?? $entry->rate) : $entry->rate;
        $dur  = $validated['duration_minutes'] ?? $entry->duration_minutes;
        $validated['amount'] = round(((float) $rate) * ($dur / 60), 2);
        $validated['rate']   = (float) $rate;

        $entry->update($validated);
        activity()->causedBy($request->user())->performedOn($entry)->log('updated');

        if ($request->expectsJson()) {
            return response()->json(['entry' => $entry->fresh(['matter', 'user'])]);
        }

        return back()->with('success', 'Time entry updated.');
    }

    public function destroy(Request $request, TimeEntry $entry): SymfonyResponse
    {
        if ($entry->firm_id !== $request->user()->firm_id) abort(403);

        if ($entry->is_locked || $entry->billed) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Entry is locked or billed.'], 422);
            }
            return back()->with('error', 'This entry cannot be deleted.');
        }

        activity()->causedBy($request->user())->performedOn($entry)->log('deleted');
        $entry->delete();

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Deleted.']);
        }

        return back()->with('success', 'Time entry deleted.');
    }

    public function checkIn(Request $request): JsonResponse
    {
        $user = $request->user();
        $key  = 'active_timer_' . $user->id;

        if (session($key)) {
            return response()->json(['error' => 'Already checked in. Check out first.'], 409);
        }

        $validated = $request->validate([
            'matter_id'     => ['required', 'uuid', 'exists:matters,id'],
            'activity_type' => ['nullable', 'in:advising,drafting,research,court_attendance,travel,telephone,correspondence,meeting,other'],
            'description'   => ['nullable', 'string', 'max:500'],
        ]);

        $matter = Matter::where('id', $validated['matter_id'])
            ->where('firm_id', $user->firm_id)
            ->firstOrFail();

        $session = [
            'matter_id'     => $matter->id,
            'matter_name'   => $matter->name,
            'matter_number' => $matter->matter_number,
            'started_at'    => now()->toIso8601String(),
            'activity_type' => $validated['activity_type'] ?? 'other',
            'description'   => $validated['description'] ?? '',
            'paused_at'     => null,
            'total_paused_seconds' => 0,
        ];

        $matterRate      = is_array($matter->custom_fields) ? ($matter->custom_fields['hourly_rate'] ?? null) : null;
        $defaultRate     = ($matterRate !== null && $matterRate !== '') ? (float) $matterRate : (float) ($user->rate_per_hour ?? $user->firm->default_hourly_rate ?? 0);
        $session['rate'] = $defaultRate;

        session([$key => $session]);

        activity()->causedBy($user)->log('checked_in_to_matter:' . $matter->name);

        return response()->json(['session' => $session]);
    }

    public function checkOut(Request $request): SymfonyResponse
    {
        $user = $request->user();
        $key  = 'active_timer_' . $user->id;
        $sess = session($key);

        if (!$sess) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'No active session.'], 404);
            }
            return back()->with('error', 'No active check-in session.');
        }

        $validated = $request->validate([
            'description'   => ['nullable', 'string', 'max:1000'],
            'activity_type' => ['nullable', 'in:advising,drafting,research,court_attendance,travel,telephone,correspondence,meeting,other'],
            'billable'      => ['boolean'],
            'rate'          => ['nullable', 'numeric', 'min:0'],
        ]);

        $startedAt       = \Carbon\Carbon::parse($sess['started_at']);
        $durationMinutes = (int) max(1, $startedAt->diffInMinutes(now()) - (($sess['total_paused_seconds'] ?? 0) / 60));

        // If currently paused, also subtract the current pause duration
        if (!empty($sess['paused_at'])) {
            $currentPause = \Carbon\Carbon::parse($sess['paused_at'])->diffInSeconds(now());
            $durationMinutes = (int) max(1, $startedAt->diffInMinutes(now()) - (($sess['total_paused_seconds'] + $currentPause) / 60));
        }

        $matter = Matter::where('id', $sess['matter_id'])
            ->where('firm_id', $user->firm_id)
            ->firstOrFail();

        $matterRateField = is_array($matter->custom_fields) ? ($matter->custom_fields['hourly_rate'] ?? null) : null;
        $matterRate      = ($matterRateField !== null && $matterRateField !== '') ? (float) $matterRateField : null;
        $fallbackRate    = $matterRate ?? (float) ($user->rate_per_hour ?? $user->firm->default_hourly_rate ?? 0);
        $rate   = array_key_exists('rate', $validated) && $validated['rate'] !== null ? (float) $validated['rate'] : $fallbackRate;
        $amount = round(((float) $rate) * ($durationMinutes / 60), 2);

        $entry = TimeEntry::create([
            'firm_id'          => $user->firm_id,
            'matter_id'        => $matter->id,
            'user_id'          => $user->id,
            'invoice_id'       => null,
            'date'             => today()->toDateString(),
            'duration_minutes' => $durationMinutes,
            'rate'             => (float) $rate,
            'amount'           => $amount,
            'billable'         => (bool) ($validated['billable'] ?? true),
            'billed'           => false,
            'activity_type'    => $validated['activity_type'] ?? $sess['activity_type'] ?? 'other',
            'description'      => $validated['description'] ?? $sess['description'] ?? null,
            'is_locked'        => false,
        ]);

        session()->forget($key);

        activity()->causedBy($user)->performedOn($entry)->log('checked_out');

        $h = intdiv($durationMinutes, 60);
        $m = $durationMinutes % 60;
        $timeStr = $h > 0 ? "{$h}h {$m}m" : "{$m}m";

        if ($request->expectsJson()) {
            return response()->json(['entry' => $entry->load(['matter', 'user']), 'duration_minutes' => $durationMinutes]);
        }

        return back()->with('success', "Checked out. {$timeStr} logged to {$matter->name}.");
    }

    public function discardSession(Request $request): JsonResponse
    {
        $key = 'active_timer_' . $request->user()->id;
        $sess = session($key);

        if ($sess) {
            activity()->causedBy($request->user())->log('session_discarded:' . ($sess['matter_name'] ?? 'unknown'));
            session()->forget($key);
        }

        return response()->json(['discarded' => true]);
    }

    public function pauseSession(Request $request): JsonResponse
    {
        $key  = 'active_timer_' . $request->user()->id;
        $sess = session($key);

        if (!$sess) {
            return response()->json(['error' => 'No active session.'], 404);
        }

        if (!empty($sess['paused_at'])) {
            return response()->json(['error' => 'Session is already paused.'], 409);
        }

        $sess['paused_at'] = now()->toIso8601String();
        session([$key => $sess]);

        return response()->json(['session' => $sess]);
    }

    public function resumeSession(Request $request): JsonResponse
    {
        $key  = 'active_timer_' . $request->user()->id;
        $sess = session($key);

        if (!$sess) {
            return response()->json(['error' => 'No active session.'], 404);
        }

        if (empty($sess['paused_at'])) {
            return response()->json(['error' => 'Session is not paused.'], 409);
        }

        $pausedAt = \Carbon\Carbon::parse($sess['paused_at']);
        $pausedSeconds = (int) $pausedAt->diffInSeconds(now());
        $sess['total_paused_seconds'] = ($sess['total_paused_seconds'] ?? 0) + $pausedSeconds;
        $sess['paused_at'] = null;
        session([$key => $sess]);

        return response()->json(['session' => $sess]);
    }

    public function startTimer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'matter_id' => ['required', 'uuid', 'exists:matters,id'],
        ]);

        $matter = Matter::where('id', $validated['matter_id'])
            ->where('firm_id', $request->user()->firm_id)
            ->firstOrFail();

        $timer = [
            'matter_id'     => $matter->id,
            'matter_name'   => $matter->name,
            'matter_number' => $matter->matter_number,
            'started_at'    => now()->toIso8601String(),
            'activity_type' => 'other',
            'description'   => '',
        ];

        session(['active_timer_' . $request->user()->id => $timer]);

        return response()->json(['timer' => $timer, 'session' => $timer]);
    }

    public function stopTimer(Request $request): JsonResponse
    {
        $key   = 'active_timer_' . $request->user()->id;
        $timer = session($key);

        if (!$timer) {
            return response()->json(['error' => 'No active timer.'], 404);
        }

        $startedAt       = \Carbon\Carbon::parse($timer['started_at']);
        $durationMinutes = (int) max(1, $startedAt->diffInMinutes(now()));

        session()->forget($key);

        return response()->json([
            'matter_id'        => $timer['matter_id'],
            'matter_name'      => $timer['matter_name'],
            'started_at'       => $timer['started_at'],
            'duration_minutes' => $durationMinutes,
        ]);
    }

    public function createInvoice(Request $request): SymfonyResponse
    {
        $user   = $request->user();
        $firmId = $user->firm_id;

        $validated = $request->validate([
            'entry_ids'     => ['required', 'array', 'min:1'],
            'entry_ids.*'   => ['uuid'],
            'expense_ids'   => ['nullable', 'array'],
            'expense_ids.*' => ['uuid'],
            'due_date'      => ['required', 'date'],
            'notes'         => ['nullable', 'string'],
        ]);

        $entries = TimeEntry::whereIn('id', $validated['entry_ids'])
            ->where('firm_id', $firmId)
            ->where('billed', false)
            ->with(['user'])
            ->get();

        if ($entries->isEmpty()) {
            return back()->with('error', 'No valid unbilled time entries found.');
        }

        $matterIds = $entries->pluck('matter_id')->unique();
        if ($matterIds->count() > 1) {
            return back()->with('error', 'All entries must belong to the same matter to create one invoice.');
        }

        $matter = Matter::where('id', $matterIds->first())->where('firm_id', $firmId)->firstOrFail();

        $expenses = collect();
        if (!empty($validated['expense_ids'])) {
            $expenses = Expense::whereIn('id', $validated['expense_ids'])
                ->where('firm_id', $firmId)
                ->where('matter_id', $matter->id)
                ->where('billed', false)
                ->get();
        }

        $invoiceId = null;

        DB::transaction(function () use ($entries, $expenses, $matter, $firmId, $user, $validated, &$invoiceId) {
            $firm = $user->firm;
            $firm->increment('invoice_sequence');
            $firm->refresh();
            $invoiceNumber = $firm->nextInvoiceNumber();

            $vatRate   = (float) ($firm->vat_rate ?? 0);
            $lineItems = [];

            foreach ($entries as $entry) {
                $amount    = (float) $entry->amount;
                $vatAmt    = round($amount * $vatRate / 100, 2);
                $label     = $entry->description ?: 'Legal services';
                $duration  = $entry->duration_formatted;
                $lineItems[] = [
                    'description' => "{$label} — {$entry->user->full_name} ({$duration})",
                    'quantity'    => round($entry->duration_minutes / 60, 2),
                    'unit_rate'   => (float) $entry->rate,
                    'amount'      => $amount,
                    'vat_amount'  => $vatAmt,
                    'type'        => 'time',
                ];
            }

            foreach ($expenses as $expense) {
                $amount    = (float) $expense->amount;
                $vatAmt    = (float) ($expense->vat_amount ?? 0);
                $label     = $expense->description;
                if ($expense->vendor) $label .= ' (' . $expense->vendor . ')';
                $lineItems[] = [
                    'description' => $label,
                    'quantity'    => 1,
                    'unit_rate'   => $amount,
                    'amount'      => $amount,
                    'vat_amount'  => $vatAmt,
                    'type'        => 'expense',
                ];
            }

            $subtotal  = collect($lineItems)->sum('amount');
            $vatTotal  = collect($lineItems)->sum('vat_amount');
            $total     = $subtotal + $vatTotal;

            $invoice = Invoice::create([
                'firm_id'         => $firmId,
                'matter_id'       => $matter->id,
                'invoice_number'  => $invoiceNumber,
                'status'          => 'draft',
                'subtotal'        => $subtotal,
                'vat_amount'      => $vatTotal,
                'vat_rate'        => $vatRate,
                'total'           => $total,
                'discount_amount' => 0,
                'due_date'        => $validated['due_date'],
                'notes'           => $validated['notes'] ?? null,
            ]);

            foreach ($lineItems as $item) {
                $invoice->lineItems()->create($item);
            }

            $entries->each(fn ($e) => $e->update(['billed' => true, 'invoice_id' => $invoice->id]));
            $expenses->each(fn ($e) => $e->update(['billed' => true, 'invoice_id' => $invoice->id]));

            activity()->causedBy($user)->performedOn($invoice)->log('invoice_created_from_time_entries');

            $invoiceId = $invoice->id;
        });

        return redirect()->route('billing.show', $invoiceId)
            ->with('success', 'Invoice created. Time entries marked as billed.');
    }
}

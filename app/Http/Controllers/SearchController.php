<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\Document;
use App\Models\Invoice;
use App\Models\Matter;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Backs the header's global search (the command palette, Cmd/Ctrl+K).
 *
 * Every category is gated by the same permission that gates its own page --
 * a user without view_invoices sees no invoice results, matching how the
 * rest of the app already restricts access -- and every query runs through
 * the BelongsToFirm scope automatically, so results never cross firms.
 *
 * Kept intentionally small: five entities that dominate "find X" (matters,
 * contacts, documents, invoices, tasks), five results each. Broader results
 * belong on each section's own filtered index, not squeezed into a palette.
 */
class SearchController extends Controller
{
    private const PER_CATEGORY_LIMIT = 5;

    public function index(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));

        if (mb_strlen($query) < 2) {
            return response()->json(['results' => []]);
        }

        $user = $request->user();
        $results = [];

        if ($user->hasPermissionTo('view_matters')) {
            $results['matters'] = Matter::query()
                ->where(function ($q) use ($query) {
                    $q->where('name', 'like', "%{$query}%")
                        ->orWhere('matter_number', 'like', "%{$query}%")
                        ->orWhere('court_reference', 'like', "%{$query}%");
                })
                ->orderBy('name')
                ->limit(self::PER_CATEGORY_LIMIT)
                ->get(['id', 'name', 'matter_number'])
                ->map(fn (Matter $m) => [
                    'id' => $m->id,
                    'title' => $m->name,
                    'subtitle' => $m->matter_number,
                    'url' => "/matters/{$m->id}",
                ]);
        }

        if ($user->hasPermissionTo('view_contacts')) {
            $results['contacts'] = Contact::query()
                ->where(function ($q) use ($query) {
                    $q->where('name', 'like', "%{$query}%")
                        ->orWhere('email', 'like', "%{$query}%")
                        ->orWhere('phone', 'like', "%{$query}%");
                })
                ->orderBy('name')
                ->limit(self::PER_CATEGORY_LIMIT)
                ->get(['id', 'name', 'email'])
                ->map(fn (Contact $c) => [
                    'id' => $c->id,
                    'title' => $c->full_name ?: $c->name,
                    'subtitle' => $c->email,
                    'url' => "/contacts/{$c->id}",
                ]);
        }

        if ($user->hasPermissionTo('view_documents')) {
            $results['documents'] = Document::query()
                // Wrapped in a closure deliberately: an un-grouped orWhere here
                // would compile as `firm_id = ? AND original_name LIKE ? OR
                // name LIKE ?`, and the OR branch would bypass the firm scope
                // entirely rather than narrowing within it.
                ->where(function ($q) use ($query) {
                    $q->where('original_name', 'like', "%{$query}%")
                        ->orWhere('name', 'like', "%{$query}%");
                })
                ->orderByDesc('created_at')
                ->limit(self::PER_CATEGORY_LIMIT)
                ->get(['id', 'name', 'original_name', 'matter_id'])
                ->map(fn (Document $d) => [
                    'id' => $d->id,
                    'title' => $d->original_name ?: $d->name,
                    'subtitle' => 'Document',
                    'url' => "/documents/{$d->id}/view",
                ]);
        }

        if ($user->hasPermissionTo('view_invoices')) {
            $results['invoices'] = Invoice::query()
                ->where('invoice_number', 'like', "%{$query}%")
                ->orderByDesc('created_at')
                ->limit(self::PER_CATEGORY_LIMIT)
                ->get(['id', 'invoice_number', 'total'])
                ->map(fn (Invoice $i) => [
                    'id' => $i->id,
                    'title' => $i->invoice_number,
                    'subtitle' => 'Invoice',
                    'url' => "/billing/{$i->id}",
                ]);
        }

        if ($user->hasPermissionTo('view_tasks')) {
            $results['tasks'] = Task::query()
                ->where('title', 'like', "%{$query}%")
                ->orderByDesc('created_at')
                ->limit(self::PER_CATEGORY_LIMIT)
                ->get(['id', 'title'])
                ->map(fn (Task $t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'subtitle' => 'Task',
                    'url' => '/tasks',
                ]);
        }

        // Drop empty categories rather than sending the client empty arrays
        // to filter out itself.
        $results = array_filter($results, fn ($group) => $group->isNotEmpty());

        return response()->json(['results' => $results]);
    }
}

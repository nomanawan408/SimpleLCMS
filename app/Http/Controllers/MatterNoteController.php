<?php

namespace App\Http\Controllers;

use App\Models\Matter;
use App\Models\Note;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class MatterNoteController extends Controller
{
    public const TYPES = ['note', 'call_log', 'email_log', 'meeting_log'];

    public function store(Matter $matter, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
            'type' => ['nullable', 'in:'.implode(',', self::TYPES)],
        ]);

        $note = Note::create([
            'firm_id'   => $request->user()->firm_id,
            'matter_id' => $matter->id,
            'user_id'   => $request->user()->id,
            'body'      => $validated['body'],
            'type'      => $validated['type'] ?? 'note',
            'logged_at' => now(),
        ]);

        activity()->causedBy($request->user())->performedOn($matter)->log('note_added');

        if ($request->expectsJson()) {
            return response()->json(['note' => $note->load('user')]);
        }

        return back()->with('success', 'Note added.');
    }

    public function update(Matter $matter, Note $note, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);
        abort_unless($note->matter_id === $matter->id, 404);
        abort_unless($this->canModify($request, $note), 403);

        $validated = $request->validate([
            'body' => ['sometimes', 'required', 'string', 'max:10000'],
            'type' => ['sometimes', 'in:'.implode(',', self::TYPES)],
            'logged_at' => ['sometimes', 'date'],
        ]);

        $note->fill($validated);
        $note->save();

        activity()->causedBy($request->user())->performedOn($matter)->log('note_updated');

        if ($request->expectsJson()) {
            return response()->json(['note' => $note->fresh()->load('user:id,full_name')]);
        }

        return back()->with('success', 'Note updated.');
    }

    public function destroy(Matter $matter, Note $note, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);
        abort_unless($note->matter_id === $matter->id, 404);
        abort_unless($this->canModify($request, $note), 403);

        $note->delete();

        activity()->causedBy($request->user())->performedOn($matter)->log('note_deleted');

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Note deleted.']);
        }

        return back()->with('success', 'Note deleted.');
    }

    /**
     * A note is someone's own record of a conversation, so only its author
     * may rewrite it. Firm admins may tidy up. The matter policy above is
     * what freezes closed files and enforces the module permission.
     */
    private function canModify(Request $request, Note $note): bool
    {
        $user = $request->user();

        return $note->user_id === $user->id || $user->isFirmAdmin();
    }
}

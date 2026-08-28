<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\Note;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Notes recorded against a contact rather than a matter -- the enquiry call
 * before a matter exists, the chase-up, the conflict-check conversation.
 */
class ContactNoteController extends Controller
{
    public const TYPES = ['note', 'call_log', 'email_log', 'meeting_log'];

    public function store(Contact $contact, Request $request): SymfonyResponse
    {
        $this->authorize('update', $contact);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
            'type' => ['nullable', 'in:'.implode(',', self::TYPES)],
            'logged_at' => ['nullable', 'date'],
        ]);

        $note = Note::create([
            'firm_id' => $request->user()->firm_id,
            'contact_id' => $contact->id,
            'matter_id' => null,
            'user_id' => $request->user()->id,
            'body' => $validated['body'],
            'type' => $validated['type'] ?? 'note',
            'logged_at' => $validated['logged_at'] ?? now(),
        ]);

        activity()->causedBy($request->user())->performedOn($contact)->log('contact_note_added');

        if ($request->expectsJson()) {
            return response()->json(['note' => $note->load('user:id,full_name')]);
        }

        return back()->with('success', 'Note added.');
    }

    public function update(Contact $contact, Note $note, Request $request): SymfonyResponse
    {
        $this->authorize('update', $contact);
        abort_unless($note->contact_id === $contact->id, 404);
        abort_unless($this->canModify($request, $note), 403);

        $validated = $request->validate([
            'body' => ['sometimes', 'required', 'string', 'max:10000'],
            'type' => ['sometimes', 'in:'.implode(',', self::TYPES)],
            'logged_at' => ['sometimes', 'date'],
        ]);

        $note->fill($validated);
        $note->save();

        activity()->causedBy($request->user())->performedOn($contact)->log('contact_note_updated');

        if ($request->expectsJson()) {
            return response()->json(['note' => $note->fresh()->load('user:id,full_name')]);
        }

        return back()->with('success', 'Note updated.');
    }

    public function destroy(Contact $contact, Note $note, Request $request): SymfonyResponse
    {
        $this->authorize('update', $contact);
        abort_unless($note->contact_id === $contact->id, 404);
        abort_unless($this->canModify($request, $note), 403);

        $note->delete();

        activity()->causedBy($request->user())->performedOn($contact)->log('contact_note_deleted');

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Note deleted.']);
        }

        return back()->with('success', 'Note deleted.');
    }

    /**
     * A note is someone's own record of a conversation, so only its author
     * may rewrite it. Anyone who can manage contacts may tidy up.
     */
    private function canModify(Request $request, Note $note): bool
    {
        $user = $request->user();

        return $note->user_id === $user->id || $user->hasPermissionTo('manage_contacts');
    }
}

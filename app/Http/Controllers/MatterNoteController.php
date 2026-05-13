<?php

namespace App\Http\Controllers;

use App\Models\Matter;
use App\Models\Note;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class MatterNoteController extends Controller
{
    public function store(Matter $matter, Request $request): SymfonyResponse
    {
        $this->authorize('update', $matter);

        $validated = $request->validate([
            'body' => ['required', 'string'],
            'type' => ['nullable', 'in:note,call_log,email_log,meeting_log'],
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
}

<?php

namespace App\Http\Controllers;

use App\Models\TablePreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TablePreferenceController extends Controller
{
    /**
     * Every row is scoped to $request->user()->id, so a user can only ever
     * read or write their own layout. A mismatched table_key simply returns
     * null preferences rather than another user's data.
     */
    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_key' => ['required', 'string', 'min:1', 'max:64', 'regex:/^[a-z0-9][a-z0-9._-]*$/i'],
        ]);

        $record = TablePreference::where('user_id', $request->user()->id)
            ->where('table_key', $validated['table_key'])
            ->first();

        return response()->json([
            'table_key'   => $validated['table_key'],
            'preferences' => $record?->preferences,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'table_key'                => ['required', 'string', 'min:1', 'max:64', 'regex:/^[a-z0-9][a-z0-9._-]*$/i'],
            'preferences'              => ['nullable', 'array'],
            'preferences.order'        => ['nullable', 'array', 'max:30'],
            'preferences.order.*'      => ['string', 'max:64'],
            'preferences.widths'       => ['nullable', 'array', 'max:30'],
            'preferences.widths.*'     => ['integer', 'min:60', 'max:800'],
            'preferences.visibility'   => ['nullable', 'array', 'max:30'],
            'preferences.visibility.*' => ['boolean'],
        ]);

        $prefs = $validated['preferences'] ?? null;

        if (empty($prefs)) {
            TablePreference::where('user_id', $request->user()->id)
                ->where('table_key', $validated['table_key'])
                ->delete();

            return response()->json(['table_key' => $validated['table_key'], 'preferences' => null]);
        }

        $record = TablePreference::updateOrCreate(
            ['user_id' => $request->user()->id, 'table_key' => $validated['table_key']],
            ['preferences' => $prefs],
        );

        return response()->json(['table_key' => $validated['table_key'], 'preferences' => $record->preferences]);
    }
}

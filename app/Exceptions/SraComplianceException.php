<?php

namespace App\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Thrown when a posting would breach an SRA Accounts Rule (e.g. a client
 * account deficit under Rule 5.3). Renders as a 422 with the reason so the
 * form can show exactly why the entry was blocked.
 */
class SraComplianceException extends Exception
{
    public function render(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['message' => $this->getMessage()], 422);
        }

        return back()->withErrors(['amount' => $this->getMessage()])->withInput();
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateFirmRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FirmController extends Controller
{
    public function setup(Request $request): Response
    {
        return Inertia::render('Admin/FirmSetup', [
            'firm'         => $request->user()->firm,
            'isSuperAdmin' => $request->user()->hasRole('super_admin'),
        ]);
    }

    public function update(UpdateFirmRequest $request): RedirectResponse
    {
        $firm = $request->user()->firm;

        $this->authorize('update', $firm);

        $firm->update($request->validated());

        activity()->causedBy($request->user())->performedOn($firm)->log('firm_updated');

        return back()->with('success', 'Firm settings updated successfully.');
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Matter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function index(Request $request): Response
    {
        $firmId = $request->user()->firm_id;

        $query = Document::where('firm_id', $firmId)
            ->with(['matter', 'uploadedBy'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('matter_id')) {
            $query->where('matter_id', $request->matter_id);
        }

        $documents = $query->paginate(25)->withQueryString();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'matters'   => Matter::where('firm_id', $firmId)->orderBy('name')->get(['id', 'name', 'matter_number']),
            'filters'   => $request->only('matter_id'),
        ]);
    }

    public function store(Request $request): SymfonyResponse
    {
        $request->validate([
            'file'             => ['required', 'file', 'max:20480'],
            'matter_id'        => ['required', 'uuid', 'exists:matters,id'],
            'is_client_visible' => ['boolean'],
        ]);

        $matter = Matter::findOrFail($request->matter_id);
        if ($matter->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        $firmId   = $request->user()->firm_id;
        $matterId = $request->matter_id;
        $file     = $request->file('file');

        $path = $file->store("documents/{$firmId}/{$matterId}", 'local');

        $document = Document::create([
            'firm_id'          => $firmId,
            'matter_id'        => $request->input('matter_id'),
            'uploaded_by_id'   => $request->user()->id,
            'name'             => $file->getClientOriginalName(),
            'original_name'    => $file->getClientOriginalName(),
            's3_key'           => $path,
            'folder'           => 'General',
            'mime_type'        => $file->getClientMimeType(),
            'size_bytes'       => $file->getSize(),
            'is_client_visible' => $request->boolean('is_client_visible'),
            'version'          => 1,
        ]);

        activity()->causedBy($request->user())->performedOn($document)->log('uploaded');

        $document->load(['matter', 'uploadedBy']);

        if ($request->expectsJson()) {
            return response()->json(['document' => $document]);
        }

        return back()->with('success', 'Document uploaded.');
    }

    public function view(Request $request, Document $document): StreamedResponse
    {
        if ($document->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        $path = $document->s3_key;

        if (!Storage::disk('local')->exists($path)) {
            abort(404, 'File not found.');
        }

        $mime = $document->mime_type ?? 'application/octet-stream';

        return response()->stream(function () use ($path) {
            $stream = Storage::disk('local')->readStream($path);
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type'        => $mime,
            'Content-Disposition' => 'inline; filename="' . ($document->original_name ?? $document->name) . '"',
            'Cache-Control'       => 'private, no-store',
        ]);
    }

    public function download(Request $request, Document $document): StreamedResponse
    {
        if ($document->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        $path = $document->s3_key;

        if (!Storage::disk('local')->exists($path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('local')->download($path, $document->original_name ?? $document->name);
    }

    public function destroy(Request $request, Document $document): SymfonyResponse
    {
        if ($document->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        $path = $document->s3_key;

        activity()->causedBy($request->user())->performedOn($document)->log('deleted');

        $document->delete();

        if ($path && Storage::disk('local')->exists($path)) {
            Storage::disk('local')->delete($path);
        }

        return back()->with('success', 'Document deleted.');
    }
}

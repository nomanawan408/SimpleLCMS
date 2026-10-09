<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Matter;
use App\Models\User;
use App\Notifications\DocumentUploadedNotification;
use App\Support\DocumentMediaType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function index(Request $request): Response
    {
        abort_unless($request->user()->is_active, 403);
        abort_unless(
            $request->user()->isFirmAdmin()
                || $request->user()->hasPermissionTo('view_documents')
                || $request->user()->hasPermissionTo('manage_documents'),
            403
        );

        $firmId = $request->user()->firm_id;

        $query = Document::where('firm_id', $firmId)->whereHas('matter', fn ($q) => $q->visibleTo($request->user()))
            ->with(['matter', 'uploadedBy'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('matter_id')) {
            $query->where('matter_id', $request->matter_id);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('original_name', 'like', "%{$search}%");
            });
        }

        $documents = $query->paginate(25)->withQueryString();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'matters'   => Matter::where('firm_id', $firmId)->visibleTo($request->user())->orderBy('name')->get(['id', 'name', 'matter_number']),
            'filters'   => $request->only('matter_id', 'search'),
        ]);
    }

    public function store(Request $request): SymfonyResponse
    {
        abort_unless($request->user()->is_active, 403);

        $request->validate([
            // An extension allowlist keeps active content (html, svg, xhtml)
            // out of the library entirely; DocumentMediaType then decides how
            // whatever did get stored is allowed to leave again.
            'file'             => [
                'required', 'file', 'max:102400',
                'extensions:'.implode(',', DocumentMediaType::ALLOWED_EXTENSIONS),
            ],
            'matter_id'        => ['required', 'uuid', Rule::exists('matters', 'id')->where(fn ($q) => $q->where('firm_id', $request->user()->firm_id))],
            'is_client_visible' => ['boolean'],
            'folder'           => ['nullable', 'string', 'max:255'],
        ]);

        $matter = Matter::findOrFail($request->matter_id);
        if ($matter->firm_id !== $request->user()->firm_id) {
            abort(404);
        }
        // Filing needs the upload permission; staff may only file into
        // matters they can see, and never into a closed archive.
        abort_unless(
            $request->user()->isFirmAdmin()
                || $request->user()->hasPermissionTo('upload_documents')
                || $request->user()->hasPermissionTo('manage_documents'),
            403
        );
        if (! $request->user()->isFirmAdmin()) {
            abort_unless(
                Matter::where('id', $matter->id)->visibleTo($request->user())->exists(),
                403
            );
            $matter->ensureMutableBy($request->user());
        }

        $firmId   = $request->user()->firm_id;
        $matterId = $request->matter_id;
        $file     = $request->file('file');

        // Third layer: the extension passed the allowlist, but the bytes are
        // what the browser would actually act on. Refuse markup and scripts
        // whatever the file happens to be called.
        $sniffed = $file->getMimeType() ?: 'application/octet-stream';

        if (! DocumentMediaType::isStorable($sniffed)) {
            throw ValidationException::withMessages([
                'file' => 'That file appears to contain web page or script content and cannot be stored.',
            ]);
        }

        $path = $file->store("documents/{$firmId}/{$matterId}", 'local');

        // Folders are named for the matter title; the tree matcher still
        // recognises legacy number-based folders so nothing ever hides.
        $defaultFolder = $matter->name ?: $matter->matter_number;
        $document = Document::create([
            'firm_id'          => $firmId,
            'matter_id'        => $request->input('matter_id'),
            'uploaded_by_id'   => $request->user()->id,
            'name'             => $file->getClientOriginalName(),
            'original_name'    => $file->getClientOriginalName(),
            's3_key'           => $path,
            'folder'           => $request->input('folder', $defaultFolder) ?: $defaultFolder,
            'mime_type'        => $sniffed,
            'size_bytes'       => $file->getSize(),
            'is_client_visible' => $request->boolean('is_client_visible'),
            'version'          => 1,
        ]);

        activity()->causedBy($request->user())->performedOn($document)->log('uploaded');

        // Tell the matter's own solicitor, unless they are the one who just
        // uploaded it -- you do not need telling about your own upload.
        if ($matter->responsible_user_id && $matter->responsible_user_id !== $request->user()->id) {
            $responsibleUser = User::where('id', $matter->responsible_user_id)->where('firm_id', $firmId)->first();
            $responsibleUser?->notify(new DocumentUploadedNotification($document, $request->user()));
        }

        $document->load(['matter', 'uploadedBy']);

        if ($request->expectsJson()) {
            return response()->json(['document' => $document]);
        }

        return back()->with('success', 'Document uploaded.');
    }

    /**
     * Firm admins open any firm document. Everyone else only documents on
     * matters they can see. Binding already 404s cross-firm rows.
     */
    /**
     * Reads need visibility only; writes additionally require an open
     * matter (closed files are a frozen archive for lawyers).
     */
    private function authorizeDocument(Request $request, Document $document, bool $forWrite = false): void
    {
        $user = $request->user();
        abort_unless($user->is_active, 403);
        if ($document->firm_id !== $user->firm_id) {
            abort(404);
        }
        if ($user->isFirmAdmin()) {
            return;
        }
        abort_unless(
            $document->matter && Matter::where('id', $document->matter_id)->visibleTo($user)->exists(),
            403
        );
        abort_unless(
            $user->hasPermissionTo($forWrite ? 'delete_documents' : 'view_documents')
                || $user->hasPermissionTo('manage_documents'),
            403
        );
        if ($forWrite) {
            $document->matter->ensureMutableBy($user);
        }
    }

    public function view(Request $request, Document $document): StreamedResponse
    {
        $this->authorizeDocument($request, $document);

        $path = $document->s3_key;

        if (!Storage::disk('local')->exists($path)) {
            abort(404, 'File not found.');
        }

        $filename = $document->original_name ?? $document->name;

        // Only known-safe types render inline. Everything else downloads, so a
        // file that slipped through upload validation still cannot execute
        // against this origin.
        $disposition = DocumentMediaType::canDisplayInline($document->mime_type)
            ? HeaderUtils::DISPOSITION_INLINE
            : HeaderUtils::DISPOSITION_ATTACHMENT;

        return response()->stream(function () use ($path) {
            $stream = Storage::disk('local')->readStream($path);
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type'        => DocumentMediaType::responseType($document->mime_type),
            // makeDisposition escapes and ASCII-folds the filename; string
            // concatenation would let a quote break the header.
            'Content-Disposition' => HeaderUtils::makeDisposition($disposition, $filename, 'document'),
            ...DocumentMediaType::protectiveHeaders(),
        ]);
    }

    public function download(Request $request, Document $document): StreamedResponse
    {
        $this->authorizeDocument($request, $document);

        $path = $document->s3_key;

        if (!Storage::disk('local')->exists($path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('local')->download(
            $path,
            $document->original_name ?? $document->name,
            DocumentMediaType::protectiveHeaders() + ['Content-Type' => 'application/octet-stream'],
        );
    }

    public function destroy(Request $request, Document $document): SymfonyResponse
    {
        $this->authorizeDocument($request, $document, forWrite: true);

        $path = $document->s3_key;

        activity()->causedBy($request->user())->performedOn($document)->log('deleted');

        $document->delete();

        if ($path && Storage::disk('local')->exists($path)) {
            Storage::disk('local')->delete($path);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Document deleted.']);
        }

        return back()->with('success', 'Document deleted.');
    }
}

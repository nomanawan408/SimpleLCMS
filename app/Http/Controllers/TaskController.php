<?php

namespace App\Http\Controllers;

use App\Models\Matter;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class TaskController extends Controller
{
    public function index(Request $request): Response
    {
        $firmId = $request->user()->firm_id;

        $query = Task::where('firm_id', $firmId)
            ->with(['matter', 'assignee'])
            ->orderByRaw("CASE status WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'review' THEN 3 ELSE 4 END")
            ->orderBy('due_date');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('assignee_id')) {
            $query->where('assignee_id', $request->assignee_id);
        }

        if ($request->filled('matter_id')) {
            $query->where('matter_id', $request->matter_id);
        }

        $tasks = $query->paginate(25)->withQueryString();

        return Inertia::render('Tasks/Index', [
            'tasks'   => $tasks,
            'users'   => User::where('firm_id', $firmId)->where('is_active', true)->get(['id', 'full_name']),
            'matters' => Matter::where('firm_id', $firmId)->orderBy('name')->get(['id', 'name', 'matter_number']),
            'filters' => $request->only('status', 'priority', 'assignee_id', 'matter_id'),
        ]);
    }

    public function store(Request $request): SymfonyResponse
    {
        $validated = $request->validate([
            'title'       => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'matter_id'   => ['nullable', 'uuid', 'exists:matters,id'],
            'assignee_id' => ['nullable', 'uuid', 'exists:users,id'],
            'due_date'    => ['nullable', 'date'],
            'priority'    => ['required', 'in:high,medium,low'],
            'status'      => ['sometimes', 'in:todo,in_progress,review,done'],
        ]);

        $validated['status'] = $validated['status'] ?? 'todo';

        if (!empty($validated['matter_id'])) {
            $matter = Matter::find($validated['matter_id']);
            if ($matter && $matter->firm_id !== $request->user()->firm_id) {
                abort(403);
            }
        }

        $task = Task::create([
            ...$validated,
            'firm_id'        => $request->user()->firm_id,
            'created_by_id'  => $request->user()->id,
        ]);

        activity()->causedBy($request->user())->performedOn($task)->log('created');

        if ($request->expectsJson()) {
            return response()->json(['task' => $task->load(['matter', 'assignee'])]);
        }

        return redirect()->route('tasks.index')->with('success', 'Task created.');
    }

    public function update(Request $request, Task $task): SymfonyResponse
    {
        if ($task->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        $validated = $request->validate([
            'title'       => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'matter_id'   => ['nullable', 'uuid', 'exists:matters,id'],
            'assignee_id' => ['nullable', 'uuid', 'exists:users,id'],
            'due_date'    => ['nullable', 'date'],
            'priority'    => ['sometimes', 'required', 'in:high,medium,low'],
            'status'      => ['sometimes', 'required', 'in:todo,in_progress,review,done'],
        ]);

        if (isset($validated['status']) && $validated['status'] === 'done' && $task->status !== 'done') {
            $validated['completed_at'] = now();
        } elseif (isset($validated['status']) && $validated['status'] !== 'done') {
            $validated['completed_at'] = null;
        }

        $task->update($validated);

        activity()->causedBy($request->user())->performedOn($task)->log('updated');

        if ($request->expectsJson()) {
            return response()->json(['task' => $task->load(['matter', 'assignee'])]);
        }

        return back()->with('success', 'Task updated.');
    }

    public function destroy(Request $request, Task $task): SymfonyResponse
    {
        if ($task->firm_id !== $request->user()->firm_id) {
            abort(403);
        }

        activity()->causedBy($request->user())->performedOn($task)->log('deleted');

        $task->delete();

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Task deleted.']);
        }

        return back()->with('success', 'Task deleted.');
    }
}

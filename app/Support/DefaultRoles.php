<?php

namespace App\Support;

/**
 * Canonical permission sets for the built-in roles.
 *
 * Single definition used by the seeder, the test harness and firm
 * provisioning, so a fresh install, a new firm and the test suite all agree
 * on what the default lawyer can do. Custom roles carry any subset of the
 * vocabulary; the built-ins below are the starting point, not a ceiling.
 */
class DefaultRoles
{
    /** Day-to-day case work on assigned matters. No money, no deletes, no admin. */
    public const LAWYER_PERMISSIONS = [
        'view_dashboard',
        'view_matters', 'create_matters', 'edit_matters',
        'view_contacts', 'create_contacts', 'edit_contacts',
        'view_time_entries', 'create_time_entries', 'edit_time_entries',
        'create_expenses', 'edit_expenses', 'delete_expenses',
        'view_documents', 'upload_documents',
        'view_calendar', 'create_events', 'edit_events',
        'view_tasks', 'create_tasks', 'edit_tasks',
        'view_ledger', 'post_ledger',
    ];
}

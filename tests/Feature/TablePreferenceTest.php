<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TablePreferenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_save_and_read_own_table_layout(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $this->actingAsUser($admin);

        $payload = [
            'table_key' => 'matters.index',
            'preferences' => [
                'order' => ['matter', 'status', 'priority'],
                'widths' => ['matter' => 300],
                'visibility' => ['priority' => false],
            ],
        ];

        $this->putJson('/table-preferences', $payload)->assertOk()->assertJsonPath('preferences.widths.matter', 300);

        $this->getJson('/table-preferences?table_key=matters.index')
            ->assertOk()
            ->assertJsonPath('preferences.visibility.priority', false);
    }

    public function test_users_cannot_read_each_others_layouts(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        [$firm2, $other] = $this->createFirmAndAdmin();
        $this->actingAsUser($admin);

        $this->putJson('/table-preferences', [
            'table_key' => 'matters.index',
            'preferences' => ['widths' => ['matter' => 300]],
        ])->assertOk();

        $this->actingAsUser($other);
        $this->getJson('/table-preferences?table_key=matters.index')
            ->assertOk()
            ->assertJsonPath('preferences', null);
    }

    public function test_invalid_widths_are_rejected(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $this->actingAsUser($admin);

        $this->putJson('/table-preferences', [
            'table_key' => 'matters.index',
            'preferences' => ['widths' => ['matter' => 5000]],
        ])->assertStatus(422);
    }

    public function test_matters_index_includes_table_preferences_prop(): void
    {
        [$firm, $admin] = $this->createFirmAndAdmin();
        $this->actingAsUser($admin);

        $this->putJson('/table-preferences', [
            'table_key' => 'matters.index',
            'preferences' => ['widths' => ['matter' => 320]],
        ])->assertOk();

        $response = $this->get('/matters');
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->has('tablePreferences.widths')
            ->where('tablePreferences.widths.matter', 320)
        );
    }
}

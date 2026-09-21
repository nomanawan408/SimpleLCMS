<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AvatarReproTest extends TestCase
{
    public function test_upload_and_display(): void
    {
        Storage::fake('public');

        [$firm, $user] = $this->createFirmAndAdmin();
        $this->actingAsUser($user);

        $tmp = tempnam(sys_get_temp_dir(), 'av') . '.png';
        imagepng(imagecreatetruecolor(100, 100), $tmp);
        $file = new UploadedFile($tmp, 'avatar.png', 'image/png', null, true);

        $resp = $this->post('/profile/avatar', ['avatar' => $file]);
        $resp->assertStatus(302);

        $user->refresh();
        echo "\nDB avatar_url = " . var_export($user->avatar_url, true) . "\n";
        echo "file exists on public disk = " . var_export(Storage::disk('public')->exists(str_replace('/storage/', '', $user->avatar_url)), true) . "\n";
        echo "absolute path = " . Storage::disk('public')->path(str_replace('/storage/', '', $user->avatar_url)) . "\n";
        echo "auth()->user()->avatar_url = " . var_export(auth()->user()->avatar_url, true) . "\n";
    }
}
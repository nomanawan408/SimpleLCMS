<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\Pivot;

class MatterUser extends Pivot
{
    use HasUuids;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $table = 'matter_user';
}

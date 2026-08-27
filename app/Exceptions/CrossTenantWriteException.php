<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when a write would place a record in a firm other than the one the
 * current request belongs to. Always a bug or an attack -- never routine.
 */
class CrossTenantWriteException extends RuntimeException {}

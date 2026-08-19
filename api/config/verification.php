<?php

return [
    'expires_minutes' => (int) env('VERIFICATION_CODE_EXPIRES', 10),
    'max_attempts' => (int) env('VERIFICATION_CODE_MAX_ATTEMPTS', 5),
    'expose_codes' => (bool) env('VERIFICATION_EXPOSE_CODES', false),
];

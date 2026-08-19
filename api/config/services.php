<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'paytr' => [
        'merchant_id' => env('PAYTR_MERCHANT_ID'),
        'merchant_key' => env('PAYTR_MERCHANT_KEY'),
        'merchant_salt' => env('PAYTR_MERCHANT_SALT'),
        'test_mode' => env('PAYTR_TEST_MODE', true),
        'debug_on' => env('PAYTR_DEBUG_ON', true),
        'timeout_limit' => env('PAYTR_TIMEOUT_LIMIT', 30),
        'no_installment' => env('PAYTR_NO_INSTALLMENT', 0),
        'max_installment' => env('PAYTR_MAX_INSTALLMENT', 0),
        'token_url' => env('PAYTR_TOKEN_URL', 'https://www.paytr.com/odeme/api/get-token'),
        'iframe_base_url' => env('PAYTR_IFRAME_BASE_URL', 'https://www.paytr.com/odeme/guvenli'),
        'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
    ],

];

<?php

/**
 * Tarayicinin WebSocket sunucusuna baglanmak icin ihtiyaci olan bilgiler.
 *
 * Sunucu tarafi yayin (api -> reverb) docker agi icinde REVERB_HOST ile
 * gider; tarayici ise disaridan baglanir, bu yuzden adres ayridir. Bu
 * degerler derleme aninda gomulmez, calisma aninda /api/realtime ucundan
 * okunur: tek bir web imaji her ortamda dogru adrese baglanabilsin diye.
 */
return [
    'enabled' => env('BROADCAST_CONNECTION') === 'reverb' && env('REVERB_APP_KEY') !== null,

    'key' => env('REVERB_APP_KEY'),

    'host' => env('REVERB_PUBLIC_HOST', 'localhost'),

    'port' => (int) env('REVERB_PUBLIC_PORT', 8092),

    'scheme' => env('REVERB_PUBLIC_SCHEME', 'http'),
];

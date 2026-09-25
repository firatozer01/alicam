<?php

return [
    // Hizmet verenin bir konusmadaki ILK mesaji icin dusulen kontor.
    // Sonraki mesajlar ucretsizdir; alici hicbir zaman odemez.
    'first_message_cost' => (int) env('MESSAGING_FIRST_MESSAGE_COST', 1),

    // Okunmamis mesaj e-postasi bu kadar dakika sonra gonderilir. Karsi taraf
    // bu sure icinde okursa e-posta hic cikmaz.
    'email_delay_minutes' => (int) env('MESSAGING_EMAIL_DELAY_MINUTES', 3),

    // Ayni kisiden gelen arka arkaya mesajlar icin tek e-posta yeter. Bu sure
    // dolmadan ikinci bir bildirim cikmaz; uygulama icindeki rozet zaten sayar.
    'email_cooldown_minutes' => (int) env('MESSAGING_EMAIL_COOLDOWN_MINUTES', 30),
];

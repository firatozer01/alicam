<?php

return [
    // Hizmet veren bir konusmayi acmak icin bir kez bu kadar kontor oder.
    // Acilan konusmada hem gelen mesajlari okur hem de sinirsiz yanit yazar.
    // Alici hicbir zaman odemez.
    'unlock_cost' => (int) env('MESSAGING_UNLOCK_COST', 1),

    // Satici bir talebi kontorle actiysa, AYNI talebe bagli konusmayi da
    // bedelsiz acsin mi.
    //
    // false (varsayilan): acmaz, ayrica oder. Site sahibinin karari —
    // teklif vermek ile ozel yazismak ayri iki sey sayiliyor.
    //
    // true: odemez. Gerekcesi "ayni is icin iki kez odeme" itirazidir;
    // teklif veren satici o talebi zaten acmistir, dolayisiyla alicinin
    // teklif ekranindan yazdigi her mesaj ona bedelsiz gelir.
    'free_when_request_unlocked' => (bool) env('MESSAGING_FREE_WHEN_REQUEST_UNLOCKED', false),

    // Konusma acilmadan alicinin ust uste yazabilecegi mesaj sayisi. Amac
    // hizmet vereni duvar metinle kontor odemeye zorlamayi engellemek.
    'locked_message_limit' => (int) env('MESSAGING_LOCKED_MESSAGE_LIMIT', 3),

    // Okunmamis mesaj e-postasi bu kadar dakika sonra gonderilir. Karsi taraf
    // bu sure icinde okursa e-posta hic cikmaz.
    'email_delay_minutes' => (int) env('MESSAGING_EMAIL_DELAY_MINUTES', 3),

    // Ayni kisiden gelen arka arkaya mesajlar icin tek e-posta yeter. Bu sure
    // dolmadan ikinci bir bildirim cikmaz; uygulama icindeki rozet zaten sayar.
    'email_cooldown_minutes' => (int) env('MESSAGING_EMAIL_COOLDOWN_MINUTES', 30),
];

<?php

use App\Http\Middleware\EnsureContactIsVerified;
use App\Http\Middleware\EnsureSellerIsApproved;
use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // API yalnızca Docker ağı/localhost üzerinden erişilen ters proxy'lerin arkasındadır.
        $middleware->trustProxies(at: '*');
        $middleware->statefulApi();
        $middleware->alias([
            'contact.verified' => EnsureContactIsVerified::class,
            'role' => EnsureUserHasRole::class,
            'seller.approved' => EnsureSellerIsApproved::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();

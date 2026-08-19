#!/bin/sh
set -eu

if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
    if [ -z "${APP_KEY:-}" ]; then
        echo "APP_KEY tanımlanmalıdır. 'php artisan key:generate --show' ile üretin." >&2
        exit 1
    fi

    php artisan migrate --force
    php artisan db:seed --force
fi

php artisan config:clear
exec "$@"

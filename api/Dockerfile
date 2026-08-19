FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

FROM php:8.4-fpm-alpine

RUN apk add --no-cache libpq \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS libpq-dev linux-headers \
    && docker-php-ext-install pcntl pdo_pgsql \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps

WORKDIR /var/www/html
COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY docker/entrypoint.sh /usr/local/bin/alicam-entrypoint

RUN rm -f bootstrap/cache/*.php \
    && php artisan package:discover --ansi \
    && chmod +x /usr/local/bin/alicam-entrypoint \
    && chown -R www-data:www-data storage bootstrap/cache

ENTRYPOINT ["alicam-entrypoint"]
CMD ["php-fpm"]

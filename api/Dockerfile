FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

FROM php:8.4-fpm-alpine

# gd: kategori kapaklarini ve panelden yuklenen gorselleri kart olcusune
# indirger. Olmadan 4 MB'lik bir yukleme anasayfaya oldugu gibi gidiyor.
RUN apk add --no-cache libpq libjpeg-turbo libpng libwebp \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS libpq-dev linux-headers \
       libjpeg-turbo-dev libpng-dev libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pcntl pdo_pgsql gd \
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

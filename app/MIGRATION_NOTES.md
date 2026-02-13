# Миграция PHP -> FastAPI/React

## Что изучено в старом проекте (`test.spiritualst.ru`)

## 1) Публичные страницы
- `index.php` — главная: услуги, галерея, расписание, контакты.
- `services.php`, `service.php` — каталог и детали услуги.
- `schedule.php` — список событий расписания.
- `contacts.php` — форма обратной связи.
- `booking.php` — запись на событие.

## 2) API и серверные действия
- `api/events.php` — выдача событий расписания.
- `api/submit_contact.php` — сохранение контакта (частично устаревший код).

## 3) Платежный контур
- `payment_handler.php`, `check_payment_status.php`, `payment_webhook.php`.
- Интеграция ЮKassa, статусы платежей и подтверждение бронирования.

## 4) Админская логика
- `admin/services.php` — CRUD услуг + загрузка медиа.
- `admin/schedule.php` — CRUD расписания, флаг индивидуального формата.
- `admin/gallery.php`, `admin/settings.php` — контент и настройки.

## 5) Основные сущности БД
- `services`, `service_media`, `schedule`, `bookings`, `contacts`, `gallery`, `settings`.

## Найденные несоответствия в legacy
- `services.php` использует поле `short_description`, которого нет в `database.sql`.
- В коде расписания используется `schedule.is_individual`, но в исходном `database.sql` этого столбца нет (появился позднее).
- `api/submit_contact.php` ссылается на `includes/db.php` и поля `contacts.whatsapp`, что расходится с основной схемой контактов.

## Что перенесено в этой итерации (`app/`)

## Backend (`app/backend`)
- FastAPI API на SQLAlchemy/MySQL:
  - `GET /api/site`
  - `GET /api/services`
  - `GET /api/services/{slug}`
  - `GET /api/schedule`
  - `POST /api/contacts`
  - `POST /api/bookings`
  - `GET /api/payments/{payment_id}/status`
  - `POST /api/payments/webhook`
  - `GET /api/admin/services`
  - `POST /api/admin/services`
  - `PUT /api/admin/services/{id}`
  - `DELETE /api/admin/services/{id}`
  - `GET /api/admin/schedule`
  - `POST /api/admin/schedule`
  - `PUT /api/admin/schedule/{id}`
  - `DELETE /api/admin/schedule/{id}`
  - `GET /api/admin/gallery`
  - `POST /api/admin/gallery`
  - `PUT /api/admin/gallery/{id}`
  - `DELETE /api/admin/gallery/{id}`
  - `GET /api/migration/status`
- Подключена раздача медиа из `Сайт Атман` через `/media/*`.
- Реализован платежный контур ЮKassa:
  - создание платежа при бронировании,
  - хранение статусов платежа в SQL,
  - webhook-обработка статусов,
  - ручная проверка статуса платежа.
- Добавлены Alembic миграции и скрипт первичного наполнения БД (`seed_from_json.py`).

## Frontend (`app/frontend`)
- React + Router.
- Главная страница:
  - hero,
  - каталог услуг с разделением форматов,
  - блок расписания.
- Страница услуги:
  - контентные секции (о практике, важно, форма одежды и т.д.),
  - галерея фото,
  - онлайн-запись с редиректом на оплату ЮKassa.
- Отдельный React-admin (`/admin`):
  - CRUD услуг,
  - CRUD расписания,
  - CRUD галереи,
  - авторизация через `X-Admin-Token`.

## Что осталось на следующем этапе
- Настроить полноценную auth-модель админки (JWT + пользователи), вместо единого token.
- Добавить загрузку файлов в admin API (сейчас только управление путями).
- Перенести/расширить блок настроек сайта и SEO-параметры.
- SEO-метаданные на уровне страниц и OpenGraph.

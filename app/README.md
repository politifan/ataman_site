# Atman Migration Start (`app/`)

Основа переноса с `PHP` на `Python + FastAPI + React` с локальной БД `SQLite` и ручным подтверждением переводов за услуги.

## Структура
- `backend/` — API и данные.
- `frontend/` — React-интерфейс (главная + страница услуги).
- `MIGRATION_NOTES.md` — карта старой логики и статус переноса.

## Быстрый запуск backend
```bash
cd app/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python init_db.py
uvicorn main:app --reload --port 8000
```

## Быстрый запуск frontend
```bash
cd app/frontend
npm install
npm run dev
```

По умолчанию frontend обращается к `http://localhost:8000`.  
Для изменения API-адреса используйте переменную `VITE_API_BASE`.
Админка доступна по маршруту `http://localhost:5173/admin`.

## Домен и уведомления
Для работы на текущем домене задайте в `backend/.env`:
```bash
SITE_URL=https://atmanvlg3.ru
CORS_ORIGINS=https://atmanvlg3.ru
```

Эти же значения можно изменить в админке в разделе `Настройки`: ключи `site_url`, `telegram_notifications_enabled`, `telegram_bot_token`, `telegram_chat_ids`.

При переносе домена:
1. Направьте `atmanvlg3.ru` на каталог проекта в панели хостинга.
2. Выпустите SSL-сертификат для `atmanvlg3.ru`.
3. Обновите `backend/.env`.
4. Запустите `./deploy.sh` из корня проекта.
5. Выполните `cd app/backend && python configure_telegram_webhook.py`.
6. Проверьте `https://atmanvlg3.ru/` и `https://atmanvlg3.ru/api/telegram/webhook`.

При старте backend автоматически заменяет сохранённые runtime-адреса `spiritualst.ru` и `atman-studio.ru` на значение `SITE_URL`.

Telegram-бот отправляет уведомления о новых онлайн-записях, сообщениях из формы контактов и заявках на сертификаты. Для включения задайте токен бота, chat id администратора и `telegram_notifications_enabled=1`.

## Ручное подтверждение оплаты
Для платных услуг клиент получает реквизиты карты, делает перевод и нажимает кнопку `Я перевёл`. Бот отправляет администратору сообщение с кнопками `Подтвердить` и `Отклонить`. Подтверждение в Telegram сразу активирует запись.

Заполните в `backend/.env`:
```bash
MANUAL_PAYMENT_BANK=Название_банка
MANUAL_PAYMENT_CARD_NUMBER=0000_0000_0000_0000
MANUAL_PAYMENT_RECIPIENT=Имя_Отчество_Ф.
MANUAL_PAYMENT_INSTRUCTIONS=Переведите_точную_сумму_и_нажмите_кнопку_Я_перевёл.
TELEGRAM_WEBHOOK_SECRET=длинная_случайная_строка
```

В значениях `MANUAL_PAYMENT_*` используйте `_` вместо пробелов. При показе реквизитов сайт автоматически заменит подчёркивания на обычные пробелы.
Для `TELEGRAM_WEBHOOK_SECRET` сгенерируйте отдельное значение без пробелов:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

После деплоя зарегистрируйте Telegram webhook из каталога `backend`. Скрипт автоматически использует `TELEGRAM_PROXY_URL`, если он задан:
```bash
python configure_telegram_webhook.py
```

Для повторной диагностики без изменения webhook:
```bash
python configure_telegram_webhook.py --status-only
```

Альтернативный ручной вызов:
```bash
curl --proxy "${TELEGRAM_PROXY_URL}" \
  -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://atmanvlg3.ru/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

После изменения `.env` перезапустите приложение: при старте оно добавит колонку резерва мест и недостающие настройки в БД автоматически.

Переменные `YOOKASSA_*` оставлены в `.env.example` только для совместимости со старыми платежами. Для новых записей на услуги они не используются.

## Медиафайлы
Картинки сайта должны лежать в каталоге `media_assets` на уровне корня проекта:
```bash
/var/www/u3115521/data/www/atmanvlg3.ru/media_assets
```

Если каталог лежит в другом месте, задайте абсолютный путь в `app/backend/.env`:
```bash
MEDIA_ROOT=/var/www/u3115521/data/www/atmanvlg3.ru/media_assets
```

После деплоя проверьте:
```bash
curl https://atmanvlg3.ru/api/media-health
curl -I https://atmanvlg3.ru/media/glavnaya.jpg
```

При необходимости принудительно переинициализировать данные:
```bash
cd app/backend
python seed_from_json.py --reset
```

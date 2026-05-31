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
SITE_URL=https://spiritualst.ru
CORS_ORIGINS=https://spiritualst.ru
```

Эти же значения можно изменить в админке в разделе `Настройки`: ключи `site_url`, `telegram_notifications_enabled`, `telegram_bot_token`, `telegram_chat_ids`.

Telegram-бот отправляет уведомления о новых онлайн-записях, сообщениях из формы контактов и заявках на сертификаты. Для включения задайте токен бота, chat id администратора и `telegram_notifications_enabled=1`.

## Ручное подтверждение оплаты
Для платных услуг клиент получает реквизиты карты, делает перевод и нажимает кнопку `Я перевёл`. Бот отправляет администратору сообщение с кнопками `Подтвердить` и `Отклонить`. Подтверждение в Telegram сразу активирует запись.

Заполните в `backend/.env`:
```bash
MANUAL_PAYMENT_BANK=Название банка
MANUAL_PAYMENT_CARD_NUMBER=0000 0000 0000 0000
MANUAL_PAYMENT_RECIPIENT=Имя Отчество Ф.
MANUAL_PAYMENT_INSTRUCTIONS=Переведите точную сумму и нажмите кнопку «Я перевёл».
TELEGRAM_WEBHOOK_SECRET=длинная_случайная_строка
```

После деплоя зарегистрируйте Telegram webhook:
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://spiritualst.ru/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Если сервер обращается к Telegram только через SOCKS-прокси, добавьте к команде `curl` аргумент `--proxy "${TELEGRAM_PROXY_URL}"`. После изменения `.env` перезапустите приложение: при старте оно добавит колонку резерва мест и недостающие настройки в БД автоматически.

Переменные `YOOKASSA_*` оставлены в `.env.example` только для совместимости со старыми платежами. Для новых записей на услуги они не используются.

При необходимости принудительно переинициализировать данные:
```bash
cd app/backend
python seed_from_json.py --reset
```

# Atman Migration Start (`app/`)

Основа переноса с `PHP` на `Python + FastAPI + React` с переходом на `MySQL + Alembic` и платежным контуром `ЮKassa`.

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
alembic upgrade head
python seed_from_json.py --reset
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
Админка доступна по маршруту `http://localhost:5173/admin` (используется `X-Admin-Token`).

## Команды Alembic
```bash
cd app/backend
alembic upgrade head
alembic downgrade -1
```

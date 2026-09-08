# Production Ledger

نظام عربي لإدارة أعمال المشغلين والعمال، مبني كتطبيقين منفصلين:

- `frontend`: React + Vite
- `backend`: Node.js + Express REST API
- `database`: PostgreSQL

## Business rules

- دورة الاستحقاق الشهرية تبدأ يوم 21 وتنتهي يوم 20 من الشهر التالي.
- مستحق المشغل = أمتار المشغل × 0.20 د.أ.
- مستحق العامل = أمتار العامل × 0.09 د.أ.
- عند وجود عاملين، تقسم الأمتار بالتساوي بينهما.
- الإضافات مستقلة تماماً عن مستحقات الأمتار ولها مجموع منفصل.
- العامل مسجل مرة واحدة ويصبح متاحاً لجميع المشغلين.

يمكن تغيير الأسعار ويوم بداية الدورة في جدول `company_settings` بدون تغيير الكود.

## Local setup

Requirements: Node.js 22+, npm, PostgreSQL 16+ (or Docker).

```bash
cp .env.example .env
docker compose up -d database
npm install
npm run db:migrate -w backend
npm run db:seed -w backend
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:4000`.

The seed command creates the administrator from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Change both values before running it. Demo data is only created when `SEED_DEMO_DATA=true`.

## Docker deployment

After creating a secure `.env` file:

```bash
docker compose up --build -d
docker compose exec api npm run db:seed
```

The web app is available at `http://localhost:8080` and the API at `http://localhost:4000`.

## API structure

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST /api/operators`
- `PATCH|DELETE /api/operators/:id`
- `GET|POST /api/workers`
- `PATCH|DELETE /api/workers/:id`
- `POST /api/records`
- `PUT|DELETE /api/records/:id`
- `GET /api/reports/operators/:id?month=YYYY-MM`
- `GET /api/reports/workers/:id?month=YYYY-MM`

All routes except health and login require a bearer token. Write operations require an `admin` or `accountant` role. Destructive people operations are soft deletes, and all changes are recorded in `audit_logs`.

## Verification

```bash
npm test
npm run build
```

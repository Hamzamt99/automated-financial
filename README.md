# Automated Financial — Production Ledger

نظام عربي لإدارة أعمال المشغلين والعمال، جاهز للعمل على Cloudflare:

- `frontend`: React + Vite على Cloudflare Workers Static Assets
- `backend`: Express API على Cloudflare Workers
- `database`: Cloudflare D1

## Business rules

- دورة الاستحقاق تبدأ يوم 21 وتنتهي يوم 20 من الشهر التالي.
- مستحق المشغل = أمتار المشغل × 0.20 د.أ.
- مستحق العامل = أمتار العامل × 0.09 د.أ.
- عند وجود عاملين، تقسم الأمتار بالتساوي بينهما.
- الإضافات مستقلة عن مستحقات الأمتار ولها مجموع منفصل.
- العامل مسجل مرة واحدة ويظهر لدى جميع المشغلين.

## Local development

Requirements: Node.js 22+ and npm.

```bash
npm install
cp backend/.dev.vars.example backend/.dev.vars
npm run db:migrate:local -w backend
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:8787`.

On an empty database, the web app shows the one-time administrator setup form. Use the same `SETUP_TOKEN` value saved in `backend/.dev.vars`. After the first administrator is created, that form is disabled automatically.

## First Cloudflare deployment

The D1 binding is already configured as `DB` for database `automated-financial-prod`.

1. Authenticate Wrangler:

   ```bash
   npx wrangler login
   ```

2. Save production secrets. Use long, different random values and keep the setup token temporarily:

   ```bash
   cd backend
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put SETUP_TOKEN
   cd ..
   ```

3. Apply the schema and deploy the API (the deploy script safely runs pending D1 migrations first):

   ```bash
   npm run deploy:api
   ```

   Wrangler prints an API URL similar to:

   ```text
   https://automated-financial-api.<your-subdomain>.workers.dev
   ```

4. Build and deploy the web app using that URL:

   ```bash
   VITE_API_URL=https://automated-financial-api.<your-subdomain>.workers.dev/api npm run deploy:web
   ```

5. Open the printed `automated-financial-web` URL. Create the first administrator using the production `SETUP_TOKEN`, then sign in.

6. Keep both secrets stored in Cloudflare. The API rejects setup permanently once the first user exists, even if someone knows the setup token.

## Cloudflare dashboard Git deployments

Create two Workers applications from the same GitHub repository.

### API application

- Project name: `automated-financial-api`
- Root directory: `backend`
- Build command: leave empty
- Deploy command: `npm run deploy`

Add the secrets `JWT_SECRET` and `SETUP_TOKEN` in the application settings. D1 is linked by `backend/wrangler.jsonc`.

### Web application

- Project name: `automated-financial-web`
- Root directory: `frontend`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Build variable: `VITE_API_URL=https://automated-financial-api.<your-subdomain>.workers.dev/api`

## Verification

```bash
npm test
npm run build
```

Useful health check:

```bash
curl https://automated-financial-api.<your-subdomain>.workers.dev/api/health
```

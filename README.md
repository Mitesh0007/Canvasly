
## Getting started

### 1. Start Postgres

```bash
docker compose up -d
```

### 2. Set up environment files

```bash
cp packages/db/.env.example packages/db/.env
```

Make sure the port in `packages/db/.env`'s `DATABASE_URL` matches whatever
you set in `docker-compose.yml`.

If you want a real `JWT_SECRET` instead of the fallback:
```bash
cp packages/backend-common/.env.example packages/backend-common/.env
```
and put a real value in it. (This step is optional — the app works fine
without it, just with a hardcoded fallback secret.)

### 3. Install dependencies

```bash
pnpm install
```
### 4. Run database migrations

```bash
cd packages/db
npx prisma migrate deploy
npx prisma generate
cd ../..
```

### 5. Start everything

```bash
pnpm dev
```

### 6. Use it

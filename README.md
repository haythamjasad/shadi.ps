# shadi.ps Workspace

This repository now contains the full Shadi workspace with three applications.

## Structure

- `frontend/` - main `shadi.ps` frontend
- `backend/` - main `shadi.ps` backend
- `Store.shadi.ps/frontend/` - store frontend
- `Store.shadi.ps/backend/` - store backend
- `admin.shadi.ps/` - admin dashboard

## Local URLs

- `shadi.ps` frontend: `http://127.0.0.1:5173`
- `shadi.ps` backend: `http://localhost:5010`
- `Store.shadi.ps` frontend: `http://localhost:3000`
- `Store.shadi.ps` backend: `http://localhost:4000`
- `admin.shadi.ps`: `http://127.0.0.1:5174`

## Setup

Each app has its own `package.json` and its own `.env.example` file.

Typical setup flow:

```bash
npm install
npm run dev
```

Run those commands inside the app you want to work on.

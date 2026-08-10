# shadi.ps Workspace

This repository contains the full Shadi workspace grouped by project.

## Structure

- `shadi/frontend/` - main `shadi.ps` frontend
- `shadi/backend/` - main `shadi.ps` backend
- `store/frontend/` - store frontend
- `store/backend/` - store backend
- `admin/frontend/` - admin dashboard frontend
- `admin/backend/` - admin project backend placeholder

## Local URLs

- `shadi.ps` frontend: `http://127.0.0.1:5173`
- `shadi.ps` backend: `http://localhost:5010`
- `store` frontend: `http://localhost:3000`
- `store` backend: `http://localhost:4000`
- `admin` frontend: `http://127.0.0.1:5174`

## Setup

Each app has its own `package.json` and its own `.env.example` file.

Typical setup flow:

```bash
npm install
npm run dev
```

Run those commands inside the app you want to work on.

Examples:

```bash
cd shadi/frontend
cd shadi/backend
cd store/frontend
cd store/backend
cd admin/frontend
```

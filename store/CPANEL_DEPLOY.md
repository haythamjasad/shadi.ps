## cPanel Deploy

Use this project with three deploy targets:

- `storefront-public` -> your main website document root, usually `public_html`
- `admin-public` -> your admin subdomain document root
- `backend-app` -> your cPanel Node.js application root

Recommended production shape for your case:

- storefront: `https://store.shadi.ps`
- admin: `https://admin.shadi.ps`
- backend API through the same main domain path: `https://store.shadi.ps/api/v01`

### 1) Build a deploy bundle locally

From the project root:

```bash
chmod +x scripts/prepare-cpanel-deploy.sh
FRONTEND_API_BASE_URL="https://store.shadi.ps/api/v01" \
ADMIN_API_BASE_URL="https://store.shadi.ps/api/v01" \
ADMIN_BASE_PATH="/" \
./scripts/prepare-cpanel-deploy.sh
```

This creates a timestamped folder inside `cpanel-deploy/` with:

- `backend-app`
- `storefront-public`
- `admin-public`
- `root-htaccess.example`

It also creates a matching zip file beside the folder, ready to upload.

### 2) Upload the React storefront

Upload the contents of `storefront-public` into your main site document root.

Notes:

- do **not** blindly overwrite the root `.htaccess` if cPanel already added Passenger/Node.js rules for `/api/v01`
- keep the cPanel-generated Passenger block for the Node app and append the React SPA rewrite rules under it
- deploy bundle now ships the storefront rewrite file as `.htaccess.react-only.example` on purpose, so it does not accidentally replace your live cPanel root `.htaccess`
- if your API is on a different domain or subdomain, set `FRONTEND_API_BASE_URL` before building

### 3) Upload the React admin app

Upload the contents of `admin-public` into the admin subdomain document root.

Notes:

- `admin/public/.htaccess` is included in the build so React routes work after refresh
- if admin is not hosted at the domain root, rebuild with `ADMIN_BASE_PATH=/your-subpath/`

### 4) Upload the Node.js backend

Upload `backend-app` to your cPanel Node.js application root.

Recommended cPanel Node.js settings:

- Application mode: `Production`
- Application root: the uploaded `backend-app` folder
- Application URL: use the path-based URL, for example `/api/v01`
- Startup file: `start.cjs`
- Node version: use the newest supported version that matches your app

If your cPanel screen asks for the URL as a path instead of a full domain, enter:

- `/api/v01`

After upload:

```bash
cd backend-app
npm install --omit=dev
```

Note:

- `start.cjs` is the safest cPanel startup file because it lives in the app root and loads `dist/index.js`
- if your cPanel fully supports nested startup files, `dist/index.js` can also work, but `start.cjs` is the recommended default

### 5) Configure backend environment variables

Use `backend-app/.env.example` as your template.

Important variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME_PROD`
- `DB_PASSWORD_PROD`
- `DB_DATABASE_PROD`
- `BASE_URL_PROD`
- `HOST_API_URL_PROD`
- `CORS_ORIGIN`
- `LAHZA_SECRET_KEY_PROD`
- `LAHZA_WEBHOOK_SECRET_PROD`
- `RECAPTCHA_SITE_KEY_PROD`
- `RECAPTCHA_SECRET_KEY_PROD`
- `SMTP_ENCRYPTION_KEY_PROD`
- `JWT_SECRET`

Set:

- `BASE_URL_PROD` to your storefront URL
- `API_PREFIX_PROD` to `/api/v01`
- `HOST_API_URL_PROD` to your full API base, for example `https://store.shadi.ps/api/v01`
- `CORS_ORIGIN` to `https://store.shadi.ps,https://admin.shadi.ps`

### 5.1) Import the database schema

Before starting the backend on cPanel, import:

- `backend-app/sql/schema.sql`

If you already have an old database with real data, import this instead first:

- `backend-app/sql/update-existing-db.sql`

Optional sample data:

- `backend-app/sql/seed.sql`

Notes:

- `schema.sql` now includes the latest tables and columns for:
  - Lahza settings
  - store currency settings
  - product color options
  - order item color fields
  - banner feature tabs
- after the base schema import, startup also runs versioned SQL files from `backend-app/sql/migrations`
- importing `schema.sql` plus starting the backend is still the safest path for a fresh deploy
- `update-existing-db.sql` is the safer option for old live databases because it only adds missing tables and columns and does not recreate existing data

### 6) Restart the Node.js app

After saving environment variables in cPanel, restart the Node.js application from the cPanel UI.

### 7) Quick checks after deploy

- `https://store.shadi.ps/api/v01/health`
- storefront homepage loads
- product page refresh works
- admin login works
- image uploads load from `https://store.shadi.ps/api/v01/uploads/...`
- checkout can initialize payment

### Root .htaccess merge example

Your `store.shadi.ps` document root `.htaccess` should keep the cPanel Passenger block for the Node app and then include the React SPA rules.

Example shape:

```apache
# cPanel/Passenger generated block - keep this
PassengerAppRoot "/home/CPANEL_USER/app/backend-app"
PassengerBaseURI "/api/v01"
PassengerNodejs "/home/CPANEL_USER/nodevenv/app/backend-app/18/bin/node"
PassengerAppType node
PassengerStartupFile start.cjs

Options -MultiViews
RewriteEngine On

RewriteRule ^api/v01(?:/|$) - [END,NC]

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [END]

RewriteRule ^ index.html [END]
```

If `https://store.shadi.ps/api/v01/health` redirects to the homepage, it means the Passenger block is missing or was overwritten.

### Notes

- The storefront currency display and Lahza payment currency follow your admin settings now
- Uploaded product files and images live in `backend-app/uploads`, so keep that folder during updates
- If you deploy a new backend version, do not delete your `.env` or `uploads`

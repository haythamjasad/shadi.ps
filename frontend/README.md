# Shadi.ps Frontend

React, TypeScript, and Vite frontend for the main `shadi.ps` website.

## Local Development

```bash
npm install
npm run dev
```

Default local URL: `http://127.0.0.1:5173`

## Environment Setup

Copy `.env.example` to `.env` and adjust values for your environment.

Main variables:

- `VITE_API_URL` - backend API base URL
- `VITE_ADMIN_URL` - admin dashboard URL
- `VITE_TOKEN_ACCESS_KEY` - browser storage key for auth token
- `VITE_BEARERKEY` - auth header prefix
- `VITE_RECAPTCHA_SITE_KEY` - public reCAPTCHA site key

## Build

```bash
npm run build
```

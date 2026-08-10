## cPanel Backend Deploy

This packages the `shadi/backend` app for cPanel Node.js App deployment.

### Build backend deploy bundle

From `shadi/` run:

```bash
chmod +x scripts/prepare-cpanel-backend-deploy.sh
./scripts/prepare-cpanel-backend-deploy.sh
```

This creates:

- `cpanel-backend/<timestamp>/backend-app/`
- `cpanel-backend/<timestamp>.zip`

### Deploy on cPanel (Node.js App)

1. Create or open your Node.js App in cPanel.
2. Set **Application root** to your backend folder (for example `backend-app`).
3. Set **Application startup file** to `app.js`.
4. Upload contents of `backend-app/` to that Application root.
5. In cPanel terminal or app command area run:

```bash
npm install --omit=dev
```

6. Create `.env` based on `.env.example` and set production values.
7. Restart the Node.js app from cPanel.

### Notes

- The deploy bundle includes built `dist/` output and `app.js` entrypoint.
- `app.js` simply runs `dist/index.js`.
- Your backend uses `PORT` from environment; cPanel injects its own port for Node apps.

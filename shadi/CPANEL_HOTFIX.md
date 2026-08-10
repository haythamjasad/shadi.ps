## cPanel Hotfix

Use this bundle when you only need to deploy the latest `shadi.ps` frontend changes to cPanel.

### Build the hotfix bundle

From `shadi/` run:

```bash
chmod +x scripts/prepare-cpanel-hotfix.sh
./scripts/prepare-cpanel-hotfix.sh
```

By default, the hotfix build uses `https://shadi.ps/api/v0` as `VITE_API_URL`.

The script now rejects `localhost`, `127.0.0.1`, and raw IP-based backend URLs so the frontend always talks to the backend through a domain on cPanel.

If you need a different backend URL, override it when building:

```bash
CPANEL_API_URL=https://your-domain.com/api/v0 ./scripts/prepare-cpanel-hotfix.sh
```

This creates:

- `cpanel-hotfix/<timestamp>/public_html-hotfix/`
- `cpanel-hotfix/<timestamp>.zip`

If `shadi/cpanel-hotfix` is not writable on your machine, the script automatically falls back to:

- `cpanel-hotfix-builds/<timestamp>/public_html-hotfix/`
- `cpanel-hotfix-builds/<timestamp>.zip`

### Upload to cPanel

1. Open File Manager for the `shadi.ps` domain.
2. Upload either:
   - the contents of `public_html-hotfix/` into `public_html`, or
   - the generated zip and extract it inside `public_html`.
3. Overwrite the existing frontend files.
4. Keep the backend app, backend `.env`, and Node.js app settings untouched.

### Notes

- This bundle only packages the frontend built output from `shadi/frontend`.
- The bundle includes the SPA rewrite file from `shadi/frontend/public/.htaccess`.
- The hotfix uses relative asset paths to avoid blank pages when cPanel serves the files from a temporary subfolder or after zip extraction.
- If cPanel caching is enabled, clear it after upload.

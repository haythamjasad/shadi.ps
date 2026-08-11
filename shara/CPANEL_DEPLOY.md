# cPanel Deploy: shara.shadi.ps

## Target

- Frontend/domain: `https://shara.shadi.ps`
- Backend API prefix: `https://shara.shadi.ps/v01/api`
- Database: MySQL
- Startup file: `app_wsgi.py`

## Important cPanel Layout

Do not upload Python source files into the public document root for `shara.shadi.ps`. If `https://shara.shadi.ps/api/sharah/reels` returns the text of `app_wsgi.py`, Apache is serving source files statically and the Python app is not connected.

Use two locations:

- Python application root, outside the public document root: contains `api/`, `services/`, `config.py`, `app_wsgi.py`, `passenger_wsgi.py`, `requirements.txt`, `data/`, `images/`, and `videos/`.
- Public document root: contains only `public/.htaccess`, `public/static/`, and `public/images/` if cPanel requires a public folder.

## Upload These Files/Folders To Python App Root

- `api/`
- `services/`
- `data/app_state.db`
- `images/`
- `videos/`
- `config.py`
- `app_wsgi.py`
- `passenger_wsgi.py`
- `requirements.txt`
- `ingest_manus_reel.py`
- `sync_public_facebook_reels.py`
- `run_scraper_once.sh`

## cPanel Python App

1. Open `Setup Python App` in cPanel.
2. Create app for domain `shara.shadi.ps`.
3. Set application root to the uploaded `shara.shadi.ps` folder.
4. Set startup file to `app_wsgi.py`.
5. Install requirements:

```bash
pip install -r requirements.txt
```

## Environment Variables

Set these in cPanel or `.env`:

```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=CPANELUSER_database
MYSQL_USER=CPANELUSER_user
MYSQL_PASSWORD=your_mysql_password
MANUS_API_KEY=your_manus_key
```

## Writable Paths

Make these writable by the Python app user:

```bash
data/
images/reel_thumbnails/
videos/reels/
```

## API URLs

The app exposes both old and new prefixes:

- `GET /v01/api/sharah/reels`
- `GET /v01/api/sharah/reels/search?q=...`
- `GET /v01/api/sharah/thumb?url=...`

The frontend now uses `/v01/api`.

## Cron Every 12 Hours

Use your real cPanel path:

```bash
0 */12 * * * /home/USERNAME/path/to/Sharah/run_scraper_once.sh
```

If Selenium/Chrome is not available on cPanel, disable this cron and update `data/app_state.db` manually before upload.

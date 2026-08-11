# شُعرة (Sharrah)

واجهة عربية RTL لعرض ريلز فيسبوك كـ “بطاقات” (مع صورة مصغّرة ورابط خارجي).

المشروع يعتمد على **MySQL** فقط، وتتم تعبئة بيانات الريلز عبر Manus أو Facebook Graph API. البحث العام يعتمد على الوسوم فقط، والوسوم تُدار من واجهات الإدارة.

## التشغيل

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.app:app --host 0.0.0.0 --port 8000 --reload
```

من نفس الجهاز افتح: `http://127.0.0.1:8000/sharah`

من الهاتف على نفس الشبكة افتح: `http://<VM_IP>:8000/sharah`

يمكنك أيضًا تشغيل نفس الأمر عبر:

```bash
./quickstart.sh
```

## Docker + MySQL

لتشغيل المشروع مع MySQL وملف الاستيراد الموجود في `mysql_import.sql`:

```bash
docker compose up --build
```

سيبدأ MySQL أولًا، ثم يُحمَّل الملف تلقائيًا داخل قاعدة البيانات، وبعدها يتصل به التطبيق مباشرة.

على cPanel استخدم `ingest_manus_reel.py` لالتقاط بيانات Reel واحد وصورته المصغرة عبر Manus بدون تفريغ أو تلخيص.

## MySQL

استخدم متغيرات البيئة التالية:

```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=CPANELUSER_database
MYSQL_USER=CPANELUSER_user
MYSQL_PASSWORD=your_mysql_password
MANUS_API_KEY=your_manus_key
```

## إعدادات Graph API

انسخ `.env.example` إلى `.env` ثم اضبط:

- `FB_PAGE_ID`
- `FB_PAGE_ACCESS_TOKEN`
- `FB_GRAPH_API_VERSION` (اختياري)

## API

- `GET /api/sharah/reels` قائمة ريلز للعرض مع العنوان والوسوم
- `GET /api/sharah/reels/search?q=...` بحث يعتمد على الوسوم فقط
- `POST /api/sharah/reels/{platform}/{reel_id}/tags` تحديث وسوم Reel من الإدارة، مع `X-Admin-Token`
- `POST /api/sharah/reels/sync-graph` مزامنة/تحديث قاعدة البيانات من Graph API
- `GET /api/sharah/reels/from-db` عرض بيانات قاعدة البيانات (يتضمن العنوان والوسوم)

## Ingest Reel واحد

```bash
python ingest_manus_reel.py --page-url "https://www.facebook.com/shadi.shirri/reels/"
```

## تحديث عناوين الريلز

## مزامنة الريلز العامة إلى MySQL

```bash
source .venv/bin/activate
python sync_public_facebook_reels_nobrowser.py --max-reels 20
```

## cPanel cron (كل 12 ساعة)

شغّل هذا الملف من cron في cPanel:

```bash
/home/USERNAME/path/to/Sharah/run_scraper_once.sh
```

أو استخدم مباشرة:

```bash
0 */12 * * * /home/USERNAME/path/to/Sharah/run_scraper_once.sh
```

## cPanel deploy

1. Create a Python app in cPanel.
2. Set the app root to this project folder.
3. Set the startup file to `passenger_wsgi.py`.
4. Install requirements with `pip install -r requirements.txt`.
5. Make sure `data/` and `images/reel_thumbnails/` are writable.
6. Add the 12-hour cron job above for the scraper.

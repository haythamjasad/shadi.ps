#!/usr/bin/env bash
source /home/haytham/Desktop/shadi-ps-github/Sharah/.venv/bin/activate
exec uvicorn api.app:app --host 0.0.0.0 --port 8000

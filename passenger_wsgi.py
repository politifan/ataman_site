import os
import sys

# Set this path to your venv python on hosting
INTERP = os.path.expanduser("/var/www/u3115521/data/venv/bin/python")
if os.path.exists(INTERP) and sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)

BASE_DIR = os.path.dirname(__file__)
os.chdir(BASE_DIR)
sys.path.append(BASE_DIR)

from a2wsgi import ASGIMiddleware
from app.backend.main import app as asgi_app

application = ASGIMiddleware(asgi_app)

import sys
import os

# Adjust this path to your actual virtualenv and project location on AlwaysData
# Replace <your_username> with your AlwaysData account name
VENV_PATH = "/home/gomoku/.local/lib/python3.13/site-packages"
PROJECT_PATH = "/home/gomoku/gomoku"
if VENV_PATH not in sys.path:
    sys.path.insert(0, VENV_PATH)
if PROJECT_PATH not in sys.path:
    sys.path.insert(0, PROJECT_PATH)

from app import app as application  # noqa: E402

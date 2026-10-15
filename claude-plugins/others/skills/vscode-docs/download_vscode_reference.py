"""Download the VS Code docs index (llms.txt).

Note: unlike code.claude.com, code.visualstudio.com does not publish an
llms-full.txt (it 404s) -- llms.txt is only an index of page URLs with short
descriptions. Full page content must be fetched per-URL with WebFetch.

Thin wrapper around ../../scripts/llms_txt_downloader.py, which holds the
download/freshness-check logic shared with the github-copilot skill.
"""

from __future__ import annotations

import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR.parent.parent / "scripts"))

from llms_txt_downloader import main  # noqa: E402

TARGET_URL = "https://code.visualstudio.com/llms.txt"

if __name__ == "__main__":
    main(TARGET_URL, SKILL_DIR)

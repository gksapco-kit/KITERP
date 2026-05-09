#!/usr/bin/env python3
"""One-off: replace KITERP / Kiterp branding with KITERP in source trees."""
from __future__ import annotations

import os

ROOTS = [
    "backend",
    "frontend",
    "vendor-web",
    "storefront-web",
    "mobile",
    "scripts",
    "docker",
    "docs",
    ".cursor/plans",
]
SKIP_DIR_NAMES = {"node_modules", "dist", "build", ".next", "__pycache__", ".git"}
SKIP_FILE_NAMES = {}  # optional
EXT = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".yml",
    ".yaml",
    ".py",
    ".html",
    ".ps1",
    ".sh",
    ".sql",
    ".toml",
    ".txt",
    ".css",
    ".scss",
    ".example",
}
EXTRA_FILES = {"Dockerfile", "Makefile", "render.yaml", ".env.example"}

REPL = [
    ("KITERP", "KITERP"),
    ("kiterp", "kiterp"),
    ("Kiterp", "Kiterp"),
    ("KITERP", "KITERP"),
    ("KITERP", "KITERP"),
    ("Kiterp", "Kiterp"),
    ("kiterp", "kiterp"),
]

MAX_BYTES = 12 * 1024 * 1024  # skip huge lockfiles


def main() -> None:
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(repo)
    changed: list[str] = []
    for rel in ROOTS:
        base = os.path.join(repo, rel)
        if not os.path.isdir(base):
            continue
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in SKIP_DIR_NAMES]
            for fn in files:
                path = os.path.join(root, fn)
                if fn in SKIP_FILE_NAMES:
                    continue
                _, ext = os.path.splitext(fn)
                if ext not in EXT and fn not in EXTRA_FILES and not fn.endswith(".env.example"):
                    continue
                try:
                    sz = os.path.getsize(path)
                    if sz > MAX_BYTES:
                        continue
                    with open(path, encoding="utf-8") as f:
                        s = f.read()
                except (OSError, UnicodeDecodeError):
                    continue
                orig = s
                for a, b in REPL:
                    s = s.replace(a, b)
                if s != orig:
                    with open(path, "w", encoding="utf-8", newline="\n") as f:
                        f.write(s)
                    changed.append(os.path.relpath(path, repo))

    # Repo root files
    for fn in (
        "README.md",
        "DEPLOY_FREE.md",
        "docker-compose.yml",
        "docker-compose.prod.yml",
        "docker-compose.dev-aws.yml",
        "render.yaml",
        "package.json",
        "seed_data.py",
        "seed_stores.py",
        "seed_variants.py",
        "start-dev.ps1",
        "import-db.ps1",
        "export-db.ps1",
    ):
        path = os.path.join(repo, fn)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, encoding="utf-8") as f:
                s = f.read()
        except (OSError, UnicodeDecodeError):
            continue
        orig = s
        for a, b in REPL:
            s = s.replace(a, b)
        if s != orig:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(s)
            changed.append(fn)

    print(f"updated {len(changed)} files")


if __name__ == "__main__":
    main()

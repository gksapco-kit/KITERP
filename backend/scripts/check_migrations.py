"""
Offline Alembic migration-graph validator (CI-friendly, no database required).

Catches the migration breakages that take a deploy down:
  - Multiple heads (forgot to merge) — ``alembic upgrade head`` becomes ambiguous.
  - A revision whose ``down_revision`` points to a revision id that does not
    exist in versions/ (the "Can't locate revision identified by 'xxxx'" class).
  - Duplicate revision ids.

Run:
    cd backend && python scripts/check_migrations.py

Exit code 0 = healthy, 1 = problem found.

NOTE: This validates the migration *files*. It does NOT validate a particular
database's stamped version. If a deployed DB is stamped at a revision that no
longer exists in the repo, fix it with:
    alembic stamp <known_good_revision>
then run `alembic upgrade head`.
"""

import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

BACKEND_DIR = Path(__file__).resolve().parents[1]


def main() -> int:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    script = ScriptDirectory.from_config(cfg)

    problems: list[str] = []

    # 1. Walk the whole graph. Alembic raises here if a down_revision / merge
    #    reference cannot be resolved to an existing revision.
    revisions = {}
    try:
        for rev in script.walk_revisions():
            if rev.revision in revisions:
                problems.append(f"Duplicate revision id: {rev.revision}")
            revisions[rev.revision] = rev
    except Exception as exc:  # ResolutionError, KeyError, etc.
        problems.append(f"Unresolvable revision graph: {exc}")

    # 2. Exactly one head.
    heads = script.get_heads()
    if len(heads) == 0:
        problems.append("No migration heads found.")
    elif len(heads) > 1:
        problems.append(
            f"Multiple heads ({len(heads)}): {', '.join(heads)} — "
            f"create a merge migration (alembic merge -m 'merge' {' '.join(heads)})."
        )

    # 3. Every declared down_revision must exist (belt-and-suspenders vs. step 1).
    for rev in revisions.values():
        downs = rev.down_revision
        if downs is None:
            continue
        for dep in (downs if isinstance(downs, (tuple, list)) else (downs,)):
            if dep and dep not in revisions:
                problems.append(
                    f"Revision {rev.revision} references missing down_revision '{dep}'."
                )

    if problems:
        print("MIGRATION CHECK FAILED:")
        for p in problems:
            print(f"  - {p}")
        return 1

    print(f"Migration graph OK: {len(revisions)} revisions, single head = {heads[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

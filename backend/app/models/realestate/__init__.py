"""Real Estate vertical models - importing this package registers every ``re_*`` table."""
from . import admin, contractors, core, land, operations, postsales, projects, receivables, supply, workforce  # noqa: F401  (Phase 0 - 7)

from .admin import *  # noqa: F401,F403
from .contractors import *  # noqa: F401,F403
from .core import *  # noqa: F401,F403
from .land import *  # noqa: F401,F403
from .operations import *  # noqa: F401,F403
from .postsales import *  # noqa: F401,F403
from .projects import *  # noqa: F401,F403
from .receivables import *  # noqa: F401,F403
from .supply import *  # noqa: F401,F403
from .workforce import *  # noqa: F401,F403

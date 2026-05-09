"""
CRM background tasks. Each module exposes a function that can be invoked
through Celery (when wired) or run inline as an async coroutine via
``app.tasks.crm.runner.run_now``.
"""

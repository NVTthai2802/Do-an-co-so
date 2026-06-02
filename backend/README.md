# Backend architecture

```text
backend/
  main.py                  FastAPI entrypoint for local run and Vercel
  init_db.py               Compatibility wrapper for schema initialization
  app/
    main.py                FastAPI app factory and router registration
    api/routes/            HTTP route handlers
    core/                  Environment, security, and runtime helpers
    db/                    Postgres connection and schema bootstrap
    schemas/               Active Pydantic request schemas
    services/              Shared application helpers
    ml/                    Recognition service, artifacts, and model tools
    legacy_sqlalchemy/     Older SQLAlchemy models/helpers kept isolated
    scripts/               Maintenance scripts
```

Keep new backend API code inside `app/api/routes`, shared logic inside `app/services`
or `app/core`, and model files inside `app/ml/artifacts`.

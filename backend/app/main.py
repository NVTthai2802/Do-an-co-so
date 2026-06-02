from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, health, recognition
from app.core.config import get_cors_origins
from app.db.connection import get_db


def create_app() -> FastAPI:
    app = FastAPI(title="KidLearn API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(recognition.router)
    app.include_router(health.router)

    @app.on_event("startup")
    def init_db():
        try:
            with get_db():
                pass
        except HTTPException:
            # Request handlers will return the actionable database error as JSON.
            pass

    return app


app = create_app()

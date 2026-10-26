from fastapi import FastAPI

from app.routes import users


def create_app() -> FastAPI:
    app = FastAPI(title="Sample Users API", version="2.0.0")
    app.include_router(users.router)
    return app


app = create_app()

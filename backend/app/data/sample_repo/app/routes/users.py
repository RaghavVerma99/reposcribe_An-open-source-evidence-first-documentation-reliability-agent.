from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v2", tags=["users"])


class User(BaseModel):
    id: int
    name: str = Field(min_length=1, max_length=80)


_USERS: dict[int, User] = {1: User(id=1, name="Ada")}


@router.get("/users", response_model=list[User])
def list_users() -> list[User]:
    """Return every user."""
    return list(_USERS.values())


@router.post("/users", response_model=User, status_code=201)
def create_user(payload: User) -> User:
    """Create a user."""
    if payload.id in _USERS:
        raise HTTPException(status_code=409, detail="User already exists")
    _USERS[payload.id] = payload
    return payload

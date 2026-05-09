# app/schemas/common.py
from pydantic import BaseModel
from typing import List, TypeVar, Generic, Optional

T = TypeVar("T")


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    size: int
    pages: int


class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None

from typing import Any, Optional

from pydantic import BaseModel, Field


class LearningResultCreate(BaseModel):
    module_key: str = Field(..., min_length=1, max_length=50)
    activity_key: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    score: float = Field(0, ge=0)
    max_score: float = Field(100, ge=0)
    accuracy: Optional[float] = Field(None, ge=0)
    time_spent_seconds: int = Field(0, ge=0)
    detail: dict[str, Any] = Field(default_factory=dict)


class DocumentSummaryReq(BaseModel):
    text: str = Field(..., min_length=1)
    source_name: Optional[str] = Field(default=None, max_length=255)
    source_type: str = Field("ocr", min_length=1, max_length=40)


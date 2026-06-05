from pydantic import BaseModel
from typing import List, Optional

class EvaluateReadingReq(BaseModel):
    reference_text: str
    spoken_text: str

class WrongWord(BaseModel):
    expected: str
    got: str

class EvaluateReadingRes(BaseModel):
    accuracy: int
    correct_words: List[str]
    wrong_words: List[WrongWord]
    missing_words: List[str]
    extra_words: List[str]
    total_words: int
    correct_count: int
    feedback: str

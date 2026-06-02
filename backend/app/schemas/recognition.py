from pydantic import BaseModel


class ImageRecognitionReq(BaseModel):
    image: str

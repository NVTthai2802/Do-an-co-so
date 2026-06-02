from pydantic import BaseModel


class RegisterReq(BaseModel):
    name: str
    email: str
    password: str


class LoginReq(BaseModel):
    email: str
    password: str

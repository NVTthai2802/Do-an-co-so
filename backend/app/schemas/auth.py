from pydantic import BaseModel


class RegisterReq(BaseModel):
    name: str
    email: str
    password: str
    confirm_password: str


class LoginReq(BaseModel):
    email: str
    password: str


class ForgotPasswordReq(BaseModel):
    email: str


class ResetPasswordReq(BaseModel):
    token: str
    password: str
    confirm_password: str


class VerifyPasswordReq(BaseModel):
    password: str

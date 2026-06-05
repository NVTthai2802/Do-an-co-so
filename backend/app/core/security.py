from passlib.context import CryptContext


# Prefer a pure-Python default so serverless deployments do not depend on bcrypt
# at hash time. Existing bcrypt hashes remain verifiable.
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    default="pbkdf2_sha256",
    deprecated="auto",
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

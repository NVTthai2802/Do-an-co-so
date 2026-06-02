def public_user(user):
    return {
        "id": user["id"],
        "name": (
            user.get("name")
            or user.get("full_name")
            or user.get("username")
            or user["email"]
        ),
        "email": user["email"],
    }

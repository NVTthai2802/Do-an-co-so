import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.network import find_free_port
from app.main import app


if __name__ == "__main__":
    import uvicorn

    port = find_free_port(8000)
    if port != 8000:
        print(f"Port 8000 dang ban, chuyen sang port {port}")
    print(f"Backend KidLearn dang chay tai http://localhost:{port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

"""Convenience launcher: `python main.py` runs the FastAPI app with uvicorn."""

import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        reload=bool(os.getenv("RELOAD", "")),
    )


if __name__ == "__main__":
    main()

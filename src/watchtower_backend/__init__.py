"""WATCHTOWER backend package entrypoints.

This package exposes:
- `create_app()`: FastAPI application factory.
- `main()`: CLI entrypoint for local development.
"""

from watchtower_backend.main import create_app as create_app


def main() -> None:
    """Print the recommended development entrypoint.

    Returns:
        None.
    """
    print("Run `uv run uvicorn watchtower_backend.main:app --reload`.")

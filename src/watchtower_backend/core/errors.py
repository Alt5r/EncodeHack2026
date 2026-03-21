"""Domain and application error types.

This module provides:
- Session and command validation errors.
- Integration and runtime-specific errors.
"""


class WatchtowerError(Exception):
    """Base class for application-specific failures."""


class SessionNotFoundError(WatchtowerError):
    """Raised when a requested session does not exist."""

    def __init__(self, session_id: str) -> None:
        """Initialize the error with the missing session identifier.

        Args:
            session_id: The missing session identifier.
        """
        self.session_id = session_id
        super().__init__(f"Session {session_id} was not found.")


class SessionAlreadyClosedError(WatchtowerError):
    """Raised when a closed session receives a mutating request."""

    def __init__(self, session_id: str) -> None:
        """Initialize the error with the closed session identifier.

        Args:
            session_id: The closed session identifier.
        """
        self.session_id = session_id
        super().__init__(f"Session {session_id} is already closed.")


class CommandValidationError(WatchtowerError):
    """Raised when a planner or client command is invalid."""

    def __init__(self, message: str) -> None:
        """Initialize the error.

        Args:
            message: Human-readable validation error message.
        """
        super().__init__(message)


class PersistenceError(WatchtowerError):
    """Raised when persistence operations fail."""


class IntegrationError(WatchtowerError):
    """Raised when an external provider fails."""

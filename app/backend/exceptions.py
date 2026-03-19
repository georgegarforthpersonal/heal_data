"""
Custom Exception Classes

Typed exceptions for better error handling and consistent API responses.
"""

from typing import Optional, Any


class AppException(Exception):
    """Base exception for application errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        detail: Optional[str] = None,
        context: Optional[dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        self.context = context or {}
        super().__init__(self.message)


class NotFoundError(AppException):
    """Resource not found."""

    def __init__(
        self,
        resource: str,
        identifier: Optional[Any] = None,
        detail: Optional[str] = None,
    ):
        message = f"{resource} not found"
        if identifier is not None:
            message = f"{resource} {identifier} not found"
        super().__init__(
            message=message,
            status_code=404,
            detail=detail or message,
            context={"resource": resource, "identifier": identifier},
        )


class ValidationError(AppException):
    """Request validation failed."""

    def __init__(
        self,
        message: str,
        field: Optional[str] = None,
        detail: Optional[str] = None,
    ):
        super().__init__(
            message=message,
            status_code=400,
            detail=detail or message,
            context={"field": field} if field else {},
        )


class DatabaseError(AppException):
    """Database operation failed."""

    def __init__(
        self,
        operation: str,
        message: Optional[str] = None,
        original_error: Optional[Exception] = None,
    ):
        detail = f"Database {operation} failed"
        if message:
            detail = f"{detail}: {message}"
        super().__init__(
            message=detail,
            status_code=500,
            detail=detail,
            context={
                "operation": operation,
                "original_error": str(original_error) if original_error else None,
            },
        )


class StorageError(AppException):
    """Storage operation failed (R2/S3)."""

    def __init__(
        self,
        operation: str,
        key: Optional[str] = None,
        message: Optional[str] = None,
        original_error: Optional[Exception] = None,
    ):
        detail = f"Storage {operation} failed"
        if key:
            detail = f"{detail} for {key}"
        if message:
            detail = f"{detail}: {message}"
        super().__init__(
            message=detail,
            status_code=500,
            detail=detail,
            context={
                "operation": operation,
                "key": key,
                "original_error": str(original_error) if original_error else None,
            },
        )


class AuthenticationError(AppException):
    """Authentication failed."""

    def __init__(
        self,
        message: str = "Authentication required",
        detail: Optional[str] = None,
    ):
        super().__init__(
            message=message,
            status_code=401,
            detail=detail or message,
        )


class AuthorizationError(AppException):
    """Authorization failed (authenticated but not permitted)."""

    def __init__(
        self,
        message: str = "Not authorized to perform this action",
        detail: Optional[str] = None,
    ):
        super().__init__(
            message=message,
            status_code=403,
            detail=detail or message,
        )


class ConflictError(AppException):
    """Resource conflict (e.g., duplicate entry)."""

    def __init__(
        self,
        message: str,
        detail: Optional[str] = None,
    ):
        super().__init__(
            message=message,
            status_code=409,
            detail=detail or message,
        )


class ProcessingError(AppException):
    """Background processing failed."""

    def __init__(
        self,
        task: str,
        message: Optional[str] = None,
        original_error: Optional[Exception] = None,
    ):
        detail = f"Processing {task} failed"
        if message:
            detail = f"{detail}: {message}"
        super().__init__(
            message=detail,
            status_code=500,
            detail=detail,
            context={
                "task": task,
                "original_error": str(original_error) if original_error else None,
            },
        )

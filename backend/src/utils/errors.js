class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super(422, 'VALIDATION_ERROR', 'One or more fields are invalid.', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(code = 'UNAUTHORIZED', message = 'Missing or invalid token.') {
    super(401, code, message);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Authenticated user\'s role does not permit this action.') {
    super(403, 'FORBIDDEN', message);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super(404, 'NOT_FOUND', message);
  }
}

class ConflictError extends AppError {
  constructor(code = 'RESOURCE_IN_USE', message = 'Resource conflict.') {
    super(409, code, message);
  }
}

module.exports = { AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError };

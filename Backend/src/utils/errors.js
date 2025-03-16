class AppError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthError extends AppError {
  constructor(message, code = 'auth/unknown-error', statusCode = 401) {
    super(message, code, statusCode);
  }
}

class NotFoundError extends AppError {
  constructor(message, code = 'not-found', statusCode = 404) {
    super(message, code, statusCode);
  }
}

class ValidationError extends AppError {
  constructor(message, code = 'validation-error', statusCode = 400) {
    super(message, code, statusCode);
  }
}

module.exports = {
  AppError,
  AuthError,
  NotFoundError,
  ValidationError
};
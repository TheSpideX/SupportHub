export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      severity: this.severity
    };
  }
}

export class NetworkError extends AppError {
  constructor(
    message: string,
    public status?: number,
    details?: Record<string, any>
  ) {
    super('NETWORK_ERROR', message, details, 'HIGH');
    this.status = status;
  }
}

export class AuthenticationError extends AppError {
  constructor(
    code: string,
    message: string,
    public redirectPath?: string,
    details?: Record<string, any>
  ) {
    super(code, message, details, 'HIGH');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, details, 'LOW');
  }
}

export class BusinessError extends AppError {
  constructor(code: string, message: string, details?: Record<string, any>) {
    super(code, message, details, 'MEDIUM');
  }
}
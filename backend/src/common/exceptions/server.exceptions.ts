import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for server-related errors
 */
export class ServerException extends HttpException {
  constructor(message: string, statusCode: HttpStatus, public readonly errorCode: string) {
    super(
      {
        error: errorCode,
        message,
        statusCode,
      },
      statusCode,
    );
  }
}

/**
 * Server not found exception
 */
export class ServerNotFoundException extends ServerException {
  constructor(serverId: string) {
    super(`Server with ID "${serverId}" not found`, HttpStatus.NOT_FOUND, 'SERVER_NOT_FOUND');
  }
}

/**
 * Server name conflict exception
 */
export class ServerNameConflictException extends ServerException {
  constructor(name: string) {
    super(
      `Server with name "${name}" already exists`,
      HttpStatus.CONFLICT,
      'SERVER_NAME_CONFLICT',
    );
  }
}

/**
 * Server has dependencies exception
 */
export class ServerHasDependenciesException extends ServerException {
  constructor(serverId: string, public readonly dependencies: any) {
    super(
      'Cannot delete server with active dependencies',
      HttpStatus.CONFLICT,
      'SERVER_HAS_DEPENDENCIES',
    );
  }

  getResponse(): any {
    return {
      error: 'SERVER_HAS_DEPENDENCIES',
      message: this.message,
      statusCode: this.getStatus(),
      dependencies: this.dependencies,
    };
  }
}

/**
 * Connection test already running exception
 */
export class ConnectionTestInProgressException extends ServerException {
  constructor(serverId: string) {
    super(
      'Connection test already in progress for this server',
      HttpStatus.CONFLICT,
      'CONNECTION_TEST_IN_PROGRESS',
    );
  }
}

/**
 * Invalid credentials exception
 */
export class InvalidCredentialsException extends ServerException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_CREDENTIALS');
  }
}

/**
 * Invalid server configuration exception
 */
export class InvalidServerConfigException extends ServerException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST, 'INVALID_SERVER_CONFIG');
  }
}

/**
 * Connection test failed exception
 */
export class ConnectionTestFailedException extends ServerException {
  constructor(message: string, public readonly testResult: any) {
    super(message, HttpStatus.BAD_REQUEST, 'CONNECTION_TEST_FAILED');
  }

  getResponse(): any {
    return {
      error: 'CONNECTION_TEST_FAILED',
      message: this.message,
      statusCode: this.getStatus(),
      testResult: this.testResult,
    };
  }
}

/**
 * Rate limit exceeded exception
 */
export class RateLimitExceededException extends ServerException {
  constructor(retryAfter: number) {
    super(
      `Rate limit exceeded. Please try again in ${retryAfter} seconds`,
      HttpStatus.TOO_MANY_REQUESTS,
      'RATE_LIMIT_EXCEEDED',
    );
  }
}

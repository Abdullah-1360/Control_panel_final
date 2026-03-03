import { CheckStatus } from '../interfaces/diagnosis-check.interface';

/**
 * Determines if a WP-CLI error is due to WordPress fatal errors
 * (broken plugins, filesystem issues, etc.) rather than a check failure
 */
export function isWordPressFatalError(errorMessage: string): boolean {
  const fatalErrorPatterns = [
    'Fatal error:',
    'critical error',
    'ftp_nlist',
    'WP_Filesystem',
    'Uncaught TypeError',
    'Uncaught Error',
    'Parse error:',
    'syntax error',
    'Call to undefined function',
    'Class not found',
    'Cannot redeclare',
  ];

  return fatalErrorPatterns.some(pattern => 
    errorMessage.includes(pattern)
  );
}

/**
 * Creates a standardized error response for check services
 * Marks WP fatal errors as SKIPPED instead of ERROR
 */
export function createCheckErrorResponse(
  checkType: any,
  error: Error,
  startTime: number,
): any {
  const errorMessage = error.message || '';
  const isWpFatalError = isWordPressFatalError(errorMessage);

  return {
    checkType,
    status: isWpFatalError ? CheckStatus.SKIPPED : CheckStatus.ERROR,
    score: 0,
    message: isWpFatalError
      ? 'Check skipped: WordPress has critical errors preventing execution'
      : `Check failed: ${errorMessage}`,
    details: {
      error: errorMessage,
      reason: isWpFatalError
        ? 'WordPress fatal error detected'
        : 'Check execution failed',
      rawOutput: errorMessage, // Include raw error as output
    },
    recommendations: isWpFatalError
      ? ['Fix WordPress critical errors before running this check']
      : [],
    duration: Date.now() - startTime,
    timestamp: new Date(),
  };
}

/**
 * Adds raw command outputs to check details
 * This ensures all command outputs are preserved for detailed frontend display
 */
export function addRawOutputs(
  details: any,
  outputs: { [key: string]: string },
): any {
  return {
    ...details,
    rawOutputs: outputs,
  };
}

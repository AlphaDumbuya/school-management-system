/**
 * Logger utility for mobile app
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

type LogLevel = keyof typeof LOG_LEVELS;

class Logger {
  private minLevel: LogLevel = 'DEBUG';

  setMinLevel(level: LogLevel) {
    this.minLevel = level;
  }

  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logLevel = LOG_LEVELS[level];
    const minLogLevel = LOG_LEVELS[this.minLevel];

    if (logLevel >= minLogLevel) {
      const prefix = `[${timestamp}] [${level}]`;
      if (data) {
        console.log(prefix, message, data);
      } else {
        console.log(prefix, message);
      }
    }
  }

  debug(message: string, data?: any) {
    this.log('DEBUG', message, data);
  }

  info(message: string, data?: any) {
    this.log('INFO', message, data);
  }

  warn(message: string, data?: any) {
    this.log('WARN', message, data);
  }

  error(message: string, data?: any) {
    this.log('ERROR', message, data);
  }
}

export const logger = new Logger();

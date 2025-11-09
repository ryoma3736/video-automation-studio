/**
 * Logger Utility
 * Structured logging for the application
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: any;
}

class Logger {
  private minLevel: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private log(level: LogLevel, message: string, context?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    const formattedMessage = `[${entry.timestamp}] [${entry.level}] ${entry.message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, context || "");
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, context || "");
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, context || "");
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, context || "");
        break;
    }
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }
}

export const logger = new Logger();

// Set level from environment variable
const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
if (envLevel && Object.values(LogLevel).includes(envLevel)) {
  logger.setLevel(envLevel);
}

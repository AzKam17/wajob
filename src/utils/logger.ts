export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
  DEBUG = 'DEBUG',
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
}

export class Logger {
  private static formatTimestamp(): string {
    return new Date().toISOString()
  }

  private static print(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      ...(data && { data }),
    }

    console.log(JSON.stringify(entry))
  }

  static info(message: string, data?: any): void {
    this.print(LogLevel.INFO, message, data)
  }

  static warn(message: string, data?: any): void {
    this.print(LogLevel.WARN, message, data)
  }

  static error(message: string, data?: any): void {
    this.print(LogLevel.ERROR, message, data)
  }

  static success(message: string, data?: any): void {
    this.print(LogLevel.SUCCESS, message, data)
  }

  static debug(message: string, data?: any): void {
    this.print(LogLevel.DEBUG, message, data)
  }
}

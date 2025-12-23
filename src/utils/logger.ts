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
  // Set to true for human-readable logs in development
  private static readonly DEV_MODE = process.env.NODE_ENV !== 'production'

  private static formatTimestamp(): string {
    return new Date().toISOString()
  }

  private static getColor(level: LogLevel): string {
    const colors = {
      [LogLevel.INFO]: '\x1b[36m',    // Cyan
      [LogLevel.WARN]: '\x1b[33m',    // Yellow
      [LogLevel.ERROR]: '\x1b[31m',   // Red
      [LogLevel.SUCCESS]: '\x1b[32m', // Green
      [LogLevel.DEBUG]: '\x1b[90m',   // Gray
    }
    return colors[level] || '\x1b[0m'
  }

  private static print(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      ...(data && { data }),
    }

    if (this.DEV_MODE) {
      // Human-readable format for development
      const reset = '\x1b[0m'
      const color = this.getColor(level)
      const time = new Date().toLocaleTimeString()

      let output = `${color}[${level}]${reset} ${time} - ${message}`

      if (data) {
        output += `\n${JSON.stringify(data, null, 2)}`
      }

      console.log(output)
    } else {
      // JSON format for production
      console.log(JSON.stringify(entry))
    }
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

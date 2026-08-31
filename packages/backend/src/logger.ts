// Structured logging
import { getConfig } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function formatTimestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  const config = getConfig();
  return levels[level] >= levels[config.LOG_LEVEL as LogLevel];
}

function format(level: LogLevel, message: string, data?: any): string {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] ${level.toUpperCase()}`;

  if (data) {
    return `${prefix}: ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix}: ${message}`;
}

export const logger = {
  debug: (message: string, data?: any) => {
    if (shouldLog('debug')) console.log(format('debug', message, data));
  },

  info: (message: string, data?: any) => {
    if (shouldLog('info')) console.log(format('info', message, data));
  },

  warn: (message: string, data?: any) => {
    if (shouldLog('warn')) console.warn(format('warn', message, data));
  },

  error: (message: string, error?: Error | any, data?: any) => {
    if (shouldLog('error')) {
      const errorInfo = {
        message: error?.message,
        stack: error?.stack,
        ...data,
      };
      console.error(format('error', message, errorInfo));
    }
  },
};

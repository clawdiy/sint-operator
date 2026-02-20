/**
 * Logger — Winston-based with file + console output
 */

import winston from 'winston';
import { existsSync, mkdirSync } from 'fs';
import type { Logger } from '../core/types.js';

export function createLogger(logDir: string): Logger {
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}] ${message}${metaStr}`;
          })
        ),
      }),
      new winston.transports.File({
        filename: `${logDir}/error.log`,
        level: 'error',
      }),
      new winston.transports.File({
        filename: `${logDir}/combined.log`,
      }),
    ],
  });

  return {
    info: (msg, meta) => logger.info(msg, meta),
    warn: (msg, meta) => logger.warn(msg, meta),
    error: (msg, meta) => logger.error(msg, meta),
    debug: (msg, meta) => logger.debug(msg, meta),
  };
}

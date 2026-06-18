import winston from "winston";

import { getSettings } from "../config/index.js";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

function buildLogger(): winston.Logger {
  const settings = getSettings();
  const isDev = settings.NODE_ENV === "development";

  const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    const base = `${ts} [${level}] ${message}${metaStr}`;
    return stack ? `${base}\n${stack}` : base;
  });

  return winston.createLogger({
    level: settings.LOG_LEVEL,
    format: combine(errors({ stack: true }), timestamp()),
    transports: [
      new winston.transports.Console({
        format: isDev
          ? combine(colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), devFormat)
          : combine(timestamp(), json()),
      }),
    ],
  });
}

let logger: winston.Logger | null = null;

export function getLogger(): winston.Logger {
  if (!logger) {
    logger = buildLogger();
  }
  return logger;
}

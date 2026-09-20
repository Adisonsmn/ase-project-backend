import { isProduction } from "../config/env";

type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    };
  }

  return { message: String(error) };
};

const write = (level: LogLevel, message: string, context?: LogContext) => {
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...context,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export const logger = {
  info: (message: string, context?: LogContext) =>
    write("info", message, context),

  warn: (message: string, context?: LogContext) =>
    write("warn", message, context),

  error: (message: string, error?: unknown, context?: LogContext) =>
    write("error", message, {
      ...context,
      ...(error !== undefined && { error: serializeError(error) }),
    }),
};

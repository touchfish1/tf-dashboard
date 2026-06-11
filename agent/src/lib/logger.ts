import pino from "pino";
import { createOpenObserveStream } from "./openobserve-transport";

const level = process.env.LOG_LEVEL || "info";

const baseConfig: pino.LoggerOptions = {
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ["*.key", "*.secret", "*.token"],
    censor: "[REDACTED]",
  },
};

const streams: pino.StreamEntry[] = [];

const isDev = process.env.NODE_ENV !== "production" && process.env.PINO_PRETTY !== "false";
if (isDev) {
  streams.push({
    stream: pino.transport({
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
    }),
  });
} else {
  streams.push({ stream: process.stdout });
}

const ooStream = createOpenObserveStream();
if (ooStream) {
  streams.push({ stream: ooStream });
}

export const logger = pino(baseConfig, pino.multistream(streams));

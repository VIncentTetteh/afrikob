import "server-only";

type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = /key|token|secret|password|authorization|cookie|email|account|wallet/i;

function redact(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, SENSITIVE_KEY.test(k) ? "[redacted]" : v]),
  );
}

function write(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "afrikob-dashboard",
    message,
    ...redact(fields),
  });
  // Structured JSON to stdout/stderr is the log transport on Vercel and containers.
  if (level === "error" || level === "warn") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

/** Minimal structured JSON logger with key-based PII redaction. */
export const logger = {
  debug: (msg: string, f?: Record<string, unknown>) => write("debug", msg, f),
  info: (msg: string, f?: Record<string, unknown>) => write("info", msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => write("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => write("error", msg, f),
};

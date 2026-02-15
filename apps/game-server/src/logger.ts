const LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 } as const;
type Level = keyof typeof LEVELS;

const currentLevel: number =
  LEVELS[(process.env['LOG_LEVEL']?.toUpperCase() as Level) ?? 'DEBUG'] ??
  LEVELS.DEBUG;

function timestamp(): string {
  return new Date().toISOString();
}

function serialize(data: unknown): string {
  if (data instanceof Error) {
    return JSON.stringify({
      name: data.name,
      message: data.message,
      stack: data.stack,
      ...(data.cause ? { cause: serialize(data.cause) } : {}),
    });
  }
  // Handle AI SDK and other errors that embed an Error as a property
  if (data && typeof data === 'object' && 'message' in data) {
    const obj = data as Record<string, unknown>;
    return JSON.stringify({
      ...obj,
      message: obj['message'],
      stack: obj['stack'],
    });
  }
  return JSON.stringify(data);
}

function format(level: Level, msg: string, data?: unknown): string {
  const base = `${timestamp()} [${level}] ${msg}`;
  return data !== undefined ? `${base} ${serialize(data)}` : base;
}

export const log = {
  error(msg: string, data?: unknown) {
    if (currentLevel >= LEVELS.ERROR)
      console.error(format('ERROR', msg, data));
  },
  warn(msg: string, data?: unknown) {
    if (currentLevel >= LEVELS.WARN)
      console.warn(format('WARN', msg, data));
  },
  info(msg: string, data?: unknown) {
    if (currentLevel >= LEVELS.INFO)
      console.info(format('INFO', msg, data));
  },
  debug(msg: string, data?: unknown) {
    if (currentLevel >= LEVELS.DEBUG)
      console.debug(format('DEBUG', msg, data));
  },
};

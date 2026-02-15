const LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 } as const;
type Level = keyof typeof LEVELS;

const currentLevel: number =
  LEVELS[(process.env['LOG_LEVEL']?.toUpperCase() as Level) ?? 'DEBUG'] ??
  LEVELS.DEBUG;

function timestamp(): string {
  return new Date().toISOString();
}

function format(level: Level, msg: string, data?: unknown): string {
  const base = `${timestamp()} [${level}] ${msg}`;
  return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
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

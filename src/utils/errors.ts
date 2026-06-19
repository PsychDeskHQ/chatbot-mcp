export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function getStatusCode(err: unknown): number {
  if (isAppError(err)) {
    return err.statusCode;
  }
  if (err instanceof Error && "statusCode" in err) {
    const code = (err as Error & { statusCode: unknown }).statusCode;
    if (typeof code === "number") {
      return code;
    }
  }
  return 500;
}

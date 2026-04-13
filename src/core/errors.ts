export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}


/** Narrow unknown errors to a message string (strict-mode catch blocks). */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Safe string for `catch (e: unknown)` and logging. */
export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

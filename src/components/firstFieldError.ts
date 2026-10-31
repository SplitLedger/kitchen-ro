export function firstFieldError(errors: readonly unknown[]): string | undefined {
  for (const error of errors) {
    if (typeof error === "string" && error) {
      return error;
    }
  }
  return undefined;
}

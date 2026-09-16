/**
 * Minimal className combiner (no extra dependency). Accepts strings,
 * falsy values (skipped), and is safe to use conditionally:
 *   cn("base", isActive && "active", className)
 */
export function cn(
  ...inputs: Array<string | number | boolean | null | undefined>
): string {
  return inputs.filter((v) => v !== false && v !== null && v !== undefined && v !== "").join(" ");
}

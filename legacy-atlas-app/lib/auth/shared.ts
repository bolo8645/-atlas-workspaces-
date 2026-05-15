export const AUTH_PATHNAME_HEADER = "x-atlas-pathname";

const PUBLIC_PATH_PREFIXES = ["/login", "/signup", "/auth/confirm", "/auth/sign-in", "/auth/sign-up"];

export function isAuthPath(pathname: string | null | undefined) {
  return Boolean(pathname && pathname.startsWith("/auth"));
}

export function isPublicPath(pathname: string | null | undefined) {
  if (!pathname) return false;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function sanitizeNextPath(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

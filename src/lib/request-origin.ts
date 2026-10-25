// Next's dev server can normalize request.url to localhost even when Chrome uses 127.0.0.1.
// Compare the browser Origin with the request Host, never with an unvalidated Origin value.
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  if (host) url.host = host;
  return url.origin;
}
export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === requestOrigin(request);
}

export function getSafeSameOriginPath(
  requestedPath: string | null,
  requestUrl: string,
  fallback: string,
) {
  if (!requestedPath?.startsWith("/")) return fallback;

  const requestOrigin = new URL(requestUrl).origin;
  const target = new URL(requestedPath, requestUrl);
  if (target.origin !== requestOrigin) return fallback;

  return `${target.pathname}${target.search}${target.hash}`;
}

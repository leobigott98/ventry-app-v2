export function normalizePagination(page: number | undefined, pageSize: number | undefined, options: { defaultPageSize: number; maxPageSize: number }) {
  const normalizedPage = Number.isFinite(page) ? Math.max(Math.trunc(page ?? 1), 1) : 1;
  const requestedSize = Number.isFinite(pageSize) ? Math.trunc(pageSize ?? options.defaultPageSize) : options.defaultPageSize;
  const normalizedPageSize = Math.min(Math.max(requestedSize, 1), options.maxPageSize);
  return { page: normalizedPage, pageSize: normalizedPageSize, from: (normalizedPage - 1) * normalizedPageSize, to: normalizedPage * normalizedPageSize - 1 };
}

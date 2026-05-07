export type PaginationQuery = {
  limit?: number;
  page?: number;
};

export function normalizePagination(query: PaginationQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  return {
    limit,
    page,
    skip: (page - 1) * limit,
  };
}

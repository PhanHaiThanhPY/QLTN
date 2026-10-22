/** Standard paginated result. Every list endpoint returns this shape. */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    /** Current page number (1-based) */
    page: number;
    /** Items per page */
    limit: number;
    /** Total number of matching rows */
    total: number;
    /** ceil(total / limit) */
    totalPages: number;
  };
}

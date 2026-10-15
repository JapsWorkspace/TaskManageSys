export const DEFAULT_PAGE_SIZE = 6

export function getPaginationState(items, currentPage = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const safeItems = Array.isArray(items) ? items : []
  const safePageSize = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(safeItems.length / safePageSize))
  const requestedPage = Number(currentPage) || 1
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const startIndex = (page - 1) * safePageSize

  return {
    page,
    pageSize: safePageSize,
    totalItems: safeItems.length,
    totalPages,
    items: safeItems.slice(startIndex, startIndex + safePageSize),
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  }
}

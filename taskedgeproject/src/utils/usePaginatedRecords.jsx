import { useState } from 'react'

import { getPaginationState } from './paginationLogic.jsx'

export function usePaginatedRecords(records, pageSize) {
  const [page, setPage] = useState(1)
  const pagination = getPaginationState(records, page, pageSize)

  return {
    ...pagination,
    setPage,
  }
}

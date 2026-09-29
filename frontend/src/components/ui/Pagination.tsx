import { Button } from './Button'

export function Pagination({ first, last, onPageChange, page, totalPages }: { first: boolean; last: boolean; onPageChange: (page: number) => void; page: number; totalPages: number }) {
  if (totalPages <= 1) return null
  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><p className="text-sm text-slate-600">Page {page + 1} of {totalPages}</p><div className="flex gap-2"><Button variant="secondary" disabled={first} onClick={() => onPageChange(page - 1)}>Previous</Button><Button variant="secondary" disabled={last} onClick={() => onPageChange(page + 1)}>Next</Button></div></nav>
}

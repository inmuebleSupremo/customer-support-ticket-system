import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title" className="space-y-4">
      <h1 id="not-found-title" className="text-3xl font-bold">Page not found</h1>
      <Link className="font-medium text-sky-700 underline" to="/">Return to ResolveDesk</Link>
    </section>
  )
}

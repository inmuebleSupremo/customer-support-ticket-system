import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppRouter } from './router'

describe('AppRouter', () => {
  it('renders the foundation shell at the root route', () => {
    window.history.pushState({}, '', '/')

    render(<AppRouter />)

    expect(screen.getByRole('heading', { name: 'ResolveDesk is being prepared.' })).toBeInTheDocument()
  })
})

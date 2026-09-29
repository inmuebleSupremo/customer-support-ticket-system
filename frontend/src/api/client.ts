const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

export const apiBaseUrl = configuredApiBaseUrl || '/api/v1'

export interface ApiProblem {
  code?: string
  detail?: string
  fieldErrors?: Record<string, string>
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ApiProblem
  ) {
    super(problem.detail ?? 'The request could not be completed.')
  }
}

interface CsrfTokenResponse {
  headerName: string
  parameterName: string
  token: string
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) {
      return undefined as T
    }
    return response.json() as Promise<T>
  }

  let problem: ApiProblem = {}
  try {
    problem = await response.json() as ApiProblem
  } catch {
    // A malformed server response still becomes a usable client error.
  }
  throw new ApiError(response.status, problem)
}

export async function fetchCsrfToken(): Promise<CsrfTokenResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/csrf`, { credentials: 'include' })
  return parseResponse<CsrfTokenResponse>(response)
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, requiresCsrf = false): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (requiresCsrf) {
    const csrfToken = await fetchCsrfToken()
    headers.set(csrfToken.headerName, csrfToken.token)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers, credentials: 'include' })
  return parseResponse<T>(response)
}

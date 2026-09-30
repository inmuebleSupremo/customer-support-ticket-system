import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import { AuthProvider } from '../features/auth/AuthContext'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { RegisterPage } from '../features/auth/RegisterPage'
import { IdentityHome } from '../features/home/IdentityHome'
import { NotFoundPage } from '../features/home/NotFoundPage'
import { CreateTicketPage } from '../features/tickets/CreateTicketPage'
import { TicketDetailPage } from '../features/tickets/TicketDetailPage'
import { TicketListPage } from '../features/tickets/TicketListPage'
import { AgentQueuePage } from '../features/tickets/AgentQueuePage'
import { UserAdministrationPage } from '../features/users/UserAdministrationPage'
import { TeamAdministrationPage } from '../features/teams/TeamAdministrationPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route index element={<IdentityHome />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER']} />}>
              <Route path="tickets" element={<TicketListPage />} />
              <Route path="tickets/new" element={<CreateTicketPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'AGENT', 'ADMIN']} />}>
              <Route path="tickets/:ticketId" element={<TicketDetailPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['AGENT', 'ADMIN']} />}>
              <Route path="queue" element={<AgentQueuePage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="admin/users" element={<UserAdministrationPage />} />
              <Route path="admin/teams" element={<TeamAdministrationPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

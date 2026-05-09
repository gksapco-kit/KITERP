/**
 * COLayout — thin wrapper for /controlling/* routes.
 * Navigation lives entirely in the main DashboardLayout sidebar.
 */
import { Outlet } from 'react-router-dom'

export default function COLayout() {
  return <Outlet />
}

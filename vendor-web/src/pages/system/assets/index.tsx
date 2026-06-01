import { Outlet, Navigate, useLocation } from 'react-router-dom'



export default function AssetsLayout() {

  const location = useLocation()

  const isRoot = location.pathname === '/system/assets' || location.pathname === '/system/assets/'



  if (isRoot) {

    return <Navigate to="/system/assets/images" replace />

  }



  return (

    <div className="flex min-h-0 min-w-0 flex-1 flex-col">

      <Outlet />

    </div>

  )

}



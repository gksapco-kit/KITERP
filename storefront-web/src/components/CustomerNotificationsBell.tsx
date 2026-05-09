import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { storeApi } from '@/api/store'
import { storeKeys, useStoreNotificationStats, useStoreNotificationsPreview } from '@/hooks/useStore'
import { cn } from '@/lib/utils'

export function CustomerNotificationsBell({
  storePath,
}: {
  storePath: (path: string) => string
}) {
  const qc = useQueryClient()
  const { data: stats } = useStoreNotificationStats()
  const { data: listData } = useStoreNotificationsPreview(8)
  const unread = stats?.unread ?? 0

  const markRead = useMutation({
    mutationFn: (id: string) => storeApi.markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storeKeys.notificationStats })
      qc.invalidateQueries({ queryKey: ['store-notifications'] })
    },
  })

  const items = listData?.items ?? []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[10px] p-0 flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[min(420px,70vh)] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unread > 0 && (
            <span className="text-xs font-normal text-muted-foreground">{unread} unread</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-stretch gap-1 py-3 cursor-pointer whitespace-normal focus:bg-muted"
              onSelect={() => {
                if (!n.is_read) markRead.mutate(n.id)
              }}
            >
              <div className="flex items-start gap-2">
                <span className={cn('text-sm font-medium flex-1', !n.is_read && 'text-foreground')}>
                  {n.title}
                </span>
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" aria-hidden />}
              </div>
              {n.message && (
                <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
              )}
              {n.reference_type === 'order' && n.reference_id && (
                <Link
                  to={storePath(`/account/orders/${n.reference_id}`)}
                  className="text-xs text-blue-600 hover:underline mt-0.5 inline-block text-left"
                  onClick={() => {
                    if (!n.is_read) markRead.mutate(n.id)
                  }}
                >
                  View order
                </Link>
              )}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={storePath('/account/notifications')} className="w-full cursor-pointer text-center font-medium">
            See all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

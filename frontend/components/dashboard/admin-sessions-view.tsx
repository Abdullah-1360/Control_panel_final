'use client'

import { useState, useEffect } from 'react'
import { Monitor, Smartphone, Tablet, Trash2, RefreshCw, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient, ApiError } from '@/lib/api/client'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'

interface AdminSession {
  id: string
  userId: string
  user: {
    id: string
    email: string
    username: string
    firstName: string | null
    lastName: string | null
  }
  ipAddress: string
  userAgent: string
  createdAt: string
  expiresAt: string
  lastActivityAt: string
}

export function AdminSessionsView() {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [userFilter, setUserFilter] = useState('')

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.getAllSessions({
        page,
        limit: 20,
        userId: userFilter || undefined,
      })
      setSessions(response.data || [])
      setTotalPages(response.pagination.totalPages)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      }
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [page, userFilter])

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase()
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="h-4 w-4" />
    }
    return <Monitor className="h-4 w-4" />
  }

  const getBrowserName = (userAgent: string) => {
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari')) return 'Safari'
    if (userAgent.includes('Edge')) return 'Edge'
    return 'Unknown'
  }

  const getOSName = (userAgent: string) => {
    if (userAgent.includes('Windows')) return 'Windows'
    if (userAgent.includes('Mac')) return 'macOS'
    if (userAgent.includes('Linux')) return 'Linux'
    if (userAgent.includes('Android')) return 'Android'
    if (userAgent.includes('iOS')) return 'iOS'
    return 'Unknown'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <Label htmlFor="user-filter">Filter by User</Label>
            <Input
              id="user-filter"
              placeholder="Enter user ID or email..."
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value)
                setPage(1)
              }}
              className="w-64"
            />
          </div>
        </div>
        <Button onClick={loadSessions} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center p-8 text-muted-foreground">
          No active sessions found
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{session.user.username}</div>
                          <div className="text-xs text-muted-foreground">{session.user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(session.userAgent)}
                        <div>
                          <div className="text-sm">{getBrowserName(session.userAgent)}</div>
                          <div className="text-xs text-muted-foreground">{getOSName(session.userAgent)}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-mono">{session.ipAddress}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(session.lastActivityAt), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(session.expiresAt), { addSuffix: true })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

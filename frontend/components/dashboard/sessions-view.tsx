"use client"

import { useState, useEffect } from "react"
import { Monitor, Smartphone, Tablet, Trash2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiClient, ApiError } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/lib/auth/store"
import { AdminSessionsView } from "./admin-sessions-view"

interface Session {
  id: string
  ipAddress: string
  userAgent: string
  createdAt: string
  expiresAt: string
  lastActivityAt: string
  isCurrent: boolean
}

export function SessionsView() {
  const { toast } = useToast()
  const { user } = useAuthStore()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadSessions = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.getMySessions()
      setSessions(response.data || [])
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
      setSessions([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    if (!confirm("Are you sure you want to revoke this session?")) return

    try {
      await apiClient.revokeSession(sessionId)
      
      // If current session was revoked, logout immediately
      if (isCurrent) {
        toast({
          title: "Session Revoked",
          description: "Your current session has been revoked. Logging out...",
          variant: "destructive",
        })
        
        // Wait a moment for user to see the message, then logout
        setTimeout(async () => {
          await useAuthStore.getState().logout()
          window.location.href = "/login"
        }, 1500)
      } else {
        loadSessions()
        toast({
          title: "Success",
          description: "Session revoked successfully",
        })
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
    }
  }

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase()
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone className="h-4 w-4" />
    }
    if (ua.includes("tablet") || ua.includes("ipad")) {
      return <Tablet className="h-4 w-4" />
    }
    return <Monitor className="h-4 w-4" />
  }

  const parseUserAgent = (userAgent: string) => {
    // Simple parsing - in production, use a proper UA parser library
    const parts = userAgent.split(" ")
    const browser = parts.find((p) => p.includes("Chrome") || p.includes("Firefox") || p.includes("Safari"))
    const os = parts.find((p) => p.includes("Windows") || p.includes("Mac") || p.includes("Linux"))
    return { browser: browser || "Unknown", os: os || "Unknown" }
  }

  const MySessionsContent = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Active Sessions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your active login sessions across devices
          </p>
        </div>
        <Button onClick={loadSessions} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Sessions Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading sessions...
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No active sessions
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const { browser, os } = parseUserAgent(session.userAgent)
                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getDeviceIcon(session.userAgent)}
                        <div>
                          <p className="font-medium text-foreground">{browser}</p>
                          <p className="text-xs text-muted-foreground">{os}</p>
                        </div>
                        {session.isCurrent && (
                          <Badge variant="default" className="ml-2">Current</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{session.ipAddress}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">Unknown</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(session.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(session.lastActivityAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(session.expiresAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {!session.isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevokeSession(session.id, session.isCurrent)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold text-foreground mb-2">About Sessions</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Sessions expire after 7 days of inactivity</li>
          <li>• You can revoke any session except your current one</li>
          <li>• Revoking a session will log out that device immediately</li>
          <li>• For security, review and revoke unfamiliar sessions</li>
        </ul>
      </div>
    </div>
  )

  // If not SUPER_ADMIN, show only my sessions
  if (user?.role?.name !== 'SUPER_ADMIN') {
    return (
      <div className="p-6">
        <MySessionsContent />
      </div>
    )
  }

  // SUPER_ADMIN sees tabs
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Session Management</h2>
        <p className="text-sm text-muted-foreground mt-1">
          View and manage active sessions across all users
        </p>
      </div>

      <Tabs defaultValue="my-sessions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-sessions">My Sessions</TabsTrigger>
          <TabsTrigger value="all-sessions">All Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="my-sessions">
          <MySessionsContent />
        </TabsContent>

        <TabsContent value="all-sessions">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold">All User Sessions</h3>
              <p className="text-sm text-muted-foreground mt-1">
                View active sessions for all users in the system
              </p>
            </div>
            <AdminSessionsView />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

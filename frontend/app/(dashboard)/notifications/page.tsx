'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NotificationRulesView } from '@/components/dashboard/notification-rules-view'
import { EmailHistoryView } from '@/components/dashboard/email-history-view'
import { BulkEmailView } from '@/components/dashboard/bulk-email-view'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthStore } from '@/lib/auth/store'
import { Bell, History, Send, AlertCircle } from 'lucide-react'

export default function NotificationsPage() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN'

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6 p-4 lg:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage notification rules, view email history, and send bulk emails
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access Denied: Only SUPER_ADMIN users can access notification management.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage notification rules, view email history, and send bulk emails
        </p>
      </div>

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="rules" className="gap-2">
            <Bell className="h-4 w-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Email History
          </TabsTrigger>
          <TabsTrigger value="bulk-email" className="gap-2">
            <Send className="h-4 w-4" />
            Send Bulk Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <NotificationRulesView />
        </TabsContent>

        <TabsContent value="history">
          <EmailHistoryView />
        </TabsContent>

        <TabsContent value="bulk-email">
          <BulkEmailView />
        </TabsContent>
      </Tabs>
    </div>
  )
}

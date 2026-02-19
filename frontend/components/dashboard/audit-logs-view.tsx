"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Download, RefreshCw, AlertCircle, CheckCircle, XCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiClient, ApiError } from "@/lib/api/client"
import { useToast } from "@/hooks/use-toast"

interface AuditLog {
  id: string
  action: string
  resource: string
  resourceId: string | null
  userId: string | null
  user: {
    username: string
    email: string
  } | null
  ipAddress: string
  userAgent: string
  severity: string
  description: string
  timestamp: string
}

export function AuditLogsView() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedAction, setSelectedAction] = useState<string>("all")
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all")

  const loadLogs = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.getAuditLogs({
        page,
        limit: 50,
        action: selectedAction !== "all" ? selectedAction : undefined,
      })
      setLogs(response.data || [])
      setTotalPages(response.pagination?.totalPages || 1)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        })
      }
      setLogs([])
      setTotalPages(1)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [page, selectedAction, selectedSeverity])

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case "high":
        return <XCircle className="h-4 w-4 text-warning" />
      case "medium":
        return <Info className="h-4 w-4 text-primary" />
      case "low":
        return <CheckCircle className="h-4 w-4 text-success" />
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      critical: "bg-destructive",
      high: "bg-warning",
      medium: "bg-primary",
      low: "bg-success",
    }
    return (
      <Badge className={variants[severity.toLowerCase()] || ""}>
        {severity}
      </Badge>
    )
  }

  const getResultBadge = (description: string, action: string) => {
    const desc = description.toLowerCase()
    const act = action.toLowerCase()
    
    // Check for explicit failure indicators
    const isFailed = desc.includes('failed') || 
                     desc.includes('error') ||
                     desc.includes('denied') ||
                     desc.includes('rejected') ||
                     desc.includes('invalid')
    
    // Check for success indicators
    const isSuccess = desc.includes('success') || 
                     desc.includes('created') ||
                     desc.includes('updated') ||
                     desc.includes('deleted') ||
                     desc.includes('logged in') ||
                     desc.includes('revoked') ||
                     desc.includes('enabled') ||
                     desc.includes('disabled') ||
                     desc.includes('sent') ||
                     desc.includes('assigned') ||
                     desc.includes('activated') ||
                     desc.includes('deactivated') ||
                     desc.includes('unlocked')
    
    // If explicitly failed, show failed
    if (isFailed) {
      return <Badge variant="destructive">Failed</Badge>
    }
    
    // If success indicators found, show success
    if (isSuccess) {
      return <Badge variant="default" className="bg-success">Success</Badge>
    }
    
    // Default to success for audit logs (they're logged after successful operations)
    return <Badge variant="default" className="bg-success">Success</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audit Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track all security-relevant actions in the system
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadLogs} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by user, action, or resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={selectedAction} onValueChange={setSelectedAction}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="LOGIN">Login</SelectItem>
            <SelectItem value="LOGOUT">Logout</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
            <SelectItem value="DELETE">Delete</SelectItem>
            <SelectItem value="MFA_ENABLED">MFA Enabled</SelectItem>
            <SelectItem value="MFA_DISABLED">MFA Disabled</SelectItem>
            <SelectItem value="PASSWORD_CHANGED">Password Changed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading audit logs...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">
                        {log.user ? log.user.username : 'System'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.user ? log.user.email : 'system@opsmanager.local'}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{log.resource}</p>
                      {log.resourceId && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {log.resourceId.substring(0, 8)}...
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.ipAddress}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(log.severity)}
                      {getSeverityBadge(log.severity)}
                    </div>
                  </TableCell>
                  <TableCell>{getResultBadge(log.description, log.action)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
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
    </div>
  )
}

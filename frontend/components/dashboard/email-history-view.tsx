'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiClient } from '@/lib/api/client'
import { History, Eye, Loader2, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface EmailHistory {
  id: string
  ruleId: string | null
  rule: { id: string; name: string } | null
  templateKey: string
  recipients: string[]
  subject: string
  htmlBody: string
  textBody: string
  variables: any
  status: string
  sentAt: string | null
  failedAt: string | null
  error: string | null
  deliveryStatus: string | null
  triggeredBy: string
  triggerEvent: string
  createdAt: string
}

export function EmailHistoryView() {
  const { toast } = useToast()
  const [emails, setEmails] = useState<EmailHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedEmail, setSelectedEmail] = useState<EmailHistory | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    ruleId: '',
    triggeredBy: '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const [rules, setRules] = useState<any[]>([])

  useEffect(() => {
    loadRules()
  }, [])

  useEffect(() => {
    loadEmails()
  }, [page, filters])

  const loadRules = async () => {
    try {
      const response = await apiClient.getNotificationRules()
      setRules(response.data)
    } catch (error: any) {
      // Ignore error, rules are optional for filtering
    }
  }

  const loadEmails = async () => {
    setIsLoading(true)
    try {
      const response = await apiClient.getEmailHistory({
        page,
        limit,
        status: filters.status || undefined,
        ruleId: filters.ruleId || undefined,
        triggeredBy: filters.triggeredBy || undefined,
      })
      setEmails(response.data)
      setTotal(response.pagination.total)
      setTotalPages(response.pagination.totalPages)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load email history',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreview = (email: EmailHistory) => {
    setSelectedEmail(email)
    setIsPreviewOpen(true)
  }

  const handleClearFilters = () => {
    setFilters({
      status: '',
      ruleId: '',
      triggeredBy: '',
    })
    setPage(1)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <Badge className="bg-green-500">Sent</Badge>
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const hasActiveFilters = filters.status || filters.ruleId || filters.triggeredBy

  if (isLoading && page === 1) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Email History
              </CardTitle>
              <CardDescription>
                View all sent emails and their delivery status
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          {showFilters && (
            <div className="mb-6 p-4 border rounded-lg space-y-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Filters</h3>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear Filters
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => {
                      setFilters({ ...filters, status: value })
                      setPage(1)
                    }}
                  >
                    <SelectTrigger id="filter-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="SENT">Sent</SelectItem>
                      <SelectItem value="FAILED">Failed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-rule">Rule</Label>
                  <Select
                    value={filters.ruleId}
                    onValueChange={(value) => {
                      setFilters({ ...filters, ruleId: value })
                      setPage(1)
                    }}
                  >
                    <SelectTrigger id="filter-rule">
                      <SelectValue placeholder="All rules" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All rules</SelectItem>
                      {rules.map((rule) => (
                        <SelectItem key={rule.id} value={rule.id}>
                          {rule.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="filter-triggered-by">Triggered By (User ID)</Label>
                  <Input
                    id="filter-triggered-by"
                    value={filters.triggeredBy}
                    onChange={(e) => setFilters({ ...filters, triggeredBy: e.target.value })}
                    placeholder="Enter user ID"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results Summary */}
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {emails.length} of {total} emails
            {hasActiveFilters && ' (filtered)'}
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {hasActiveFilters
                      ? 'No emails found matching the filters'
                      : 'No emails sent yet'}
                  </TableCell>
                </TableRow>
              ) : (
                emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="text-sm">
                      {format(new Date(email.createdAt), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">
                      {email.subject}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {email.recipients.slice(0, 2).map((recipient, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {recipient}
                          </Badge>
                        ))}
                        {email.recipients.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{email.recipients.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {email.rule ? (
                        <Badge variant="secondary" className="text-xs">
                          {email.rule.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Manual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {email.triggerEvent}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(email.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(email)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              Sent on {selectedEmail && format(new Date(selectedEmail.createdAt), 'MMMM d, yyyy at HH:mm')}
            </DialogDescription>
          </DialogHeader>

          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedEmail.status)}</div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Rule</Label>
                  <div className="mt-1">
                    {selectedEmail.rule ? (
                      <Badge variant="secondary">{selectedEmail.rule.name}</Badge>
                    ) : (
                      <Badge variant="outline">Manual Send</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Trigger Event</Label>
                  <div className="mt-1">
                    <Badge variant="outline">{selectedEmail.triggerEvent}</Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Template</Label>
                  <div className="mt-1">
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                      {selectedEmail.templateKey}
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Recipients</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedEmail.recipients.map((recipient, idx) => (
                    <Badge key={idx} variant="outline">
                      {recipient}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <p className="mt-1 text-sm">{selectedEmail.subject}</p>
              </div>

              {selectedEmail.variables && Object.keys(selectedEmail.variables).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Variables</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(selectedEmail.variables, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedEmail.status === 'FAILED' && selectedEmail.error && (
                <div>
                  <Label className="text-sm font-medium text-red-500">Error</Label>
                  <p className="mt-1 text-sm text-red-500">{selectedEmail.error}</p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">HTML Content</Label>
                <div
                  className="mt-1 border rounded-md p-4 bg-white text-black max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody }}
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Plain Text Content</Label>
                <pre className="mt-1 border rounded-md p-4 bg-muted text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {selectedEmail.textBody}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

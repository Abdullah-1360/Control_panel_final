'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { apiClient } from '@/lib/api/client'
import { Send, Loader2, AlertCircle, CheckCircle2, Users, Mail } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface EmailTemplate {
  key: string
  name: string
  variables: string[]
}

export function BulkEmailView() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{
    total: number
    sent: number
    failed: number
  } | null>(null)

  const [formData, setFormData] = useState({
    templateKey: '',
    recipientType: 'custom', // custom, users, roles, all
    selectedUsers: [] as string[],
    selectedRoles: [] as string[],
    customEmails: '',
    variables: {} as Record<string, string>,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [templatesRes, usersRes, rolesRes] = await Promise.all([
        apiClient.getEmailTemplates(),
        apiClient.getUsers({ limit: 1000 }),
        apiClient.getRoles(),
      ])
      setTemplates(templatesRes.data)
      setUsers(usersRes.data)
      setRoles(rolesRes.data)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getRecipients = (): string[] => {
    const recipients: string[] = []

    if (formData.recipientType === 'custom') {
      const emails = formData.customEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0)
      recipients.push(...emails)
    } else if (formData.recipientType === 'users') {
      const selectedUserEmails = users
        .filter((u) => formData.selectedUsers.includes(u.id))
        .map((u) => u.email)
      recipients.push(...selectedUserEmails)
    } else if (formData.recipientType === 'roles') {
      const selectedRoleIds = formData.selectedRoles
      const roleUserEmails = users
        .filter((u) => selectedRoleIds.includes(u.role.id))
        .map((u) => u.email)
      recipients.push(...roleUserEmails)
    } else if (formData.recipientType === 'all') {
      recipients.push(...users.map((u) => u.email))
    }

    // Remove duplicates
    return [...new Set(recipients)]
  }

  const selectedTemplate = templates.find((t) => t.key === formData.templateKey)
  const recipients = getRecipients()

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (recipients.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one recipient',
        variant: 'destructive',
      })
      return
    }

    if (!selectedTemplate) {
      toast({
        title: 'Error',
        description: 'Please select a template',
        variant: 'destructive',
      })
      return
    }

    // Check if all required variables are filled
    const missingVariables = selectedTemplate.variables.filter(
      (v) => !formData.variables[v] || formData.variables[v].trim() === ''
    )

    if (missingVariables.length > 0) {
      toast({
        title: 'Error',
        description: `Please fill in all template variables: ${missingVariables.join(', ')}`,
        variant: 'destructive',
      })
      return
    }

    setIsSending(true)
    setSendResult(null)

    try {
      const response = await apiClient.sendBulkEmail({
        templateKey: formData.templateKey,
        recipients,
        variables: formData.variables,
      })

      setSendResult(response.data)
      toast({
        title: 'Success',
        description: `Sent ${response.data.sent} of ${response.data.total} emails successfully`,
      })

      // Reset form
      setFormData({
        templateKey: '',
        recipientType: 'custom',
        selectedUsers: [],
        selectedRoles: [],
        customEmails: '',
        variables: {},
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send bulk email',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleTemplateChange = (templateKey: string) => {
    const template = templates.find((t) => t.key === templateKey)
    if (template) {
      // Initialize variables object
      const variables: Record<string, string> = {}
      template.variables.forEach((v) => {
        variables[v] = ''
      })
      setFormData({
        ...formData,
        templateKey,
        variables,
      })
    }
  }

  if (isLoading) {
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
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Bulk Email
          </CardTitle>
          <CardDescription>
            Send emails to multiple recipients using a template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-6">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label htmlFor="bulk-template">Email Template *</Label>
              <Select
                value={formData.templateKey}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger id="bulk-template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recipient Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="bulk-recipient-type">Recipient Type *</Label>
              <Select
                value={formData.recipientType}
                onValueChange={(value) =>
                  setFormData({ ...formData, recipientType: value })
                }
              >
                <SelectTrigger id="bulk-recipient-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Custom Email Addresses
                    </div>
                  </SelectItem>
                  <SelectItem value="users">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Specific Users
                    </div>
                  </SelectItem>
                  <SelectItem value="roles">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Users by Role
                    </div>
                  </SelectItem>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      All Active Users
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Recipient Configuration */}
            {formData.recipientType === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="bulk-emails">Email Addresses *</Label>
                <Textarea
                  id="bulk-emails"
                  value={formData.customEmails}
                  onChange={(e) =>
                    setFormData({ ...formData, customEmails: e.target.value })
                  }
                  placeholder="user1@example.com, user2@example.com, user3@example.com"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Enter comma-separated email addresses
                </p>
              </div>
            )}

            {formData.recipientType === 'users' && (
              <div className="space-y-2">
                <Label>Select Users *</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!formData.selectedUsers.includes(value)) {
                      setFormData({
                        ...formData,
                        selectedUsers: [...formData.selectedUsers, value],
                      })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add users" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.selectedUsers.map((userId) => {
                    const user = users.find((u) => u.id === userId)
                    return (
                      <Badge key={userId} variant="secondary">
                        {user?.username}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              selectedUsers: formData.selectedUsers.filter(
                                (id) => id !== userId
                              ),
                            })
                          }}
                          className="ml-2"
                        >
                          ×
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {formData.recipientType === 'roles' && (
              <div className="space-y-2">
                <Label>Select Roles *</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!formData.selectedRoles.includes(value)) {
                      setFormData({
                        ...formData,
                        selectedRoles: [...formData.selectedRoles, value],
                      })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Add roles" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.displayName} ({role.userCount} users)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.selectedRoles.map((roleId) => {
                    const role = roles.find((r) => r.id === roleId)
                    return (
                      <Badge key={roleId} variant="secondary">
                        {role?.displayName}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              selectedRoles: formData.selectedRoles.filter(
                                (id) => id !== roleId
                              ),
                            })
                          }}
                          className="ml-2"
                        >
                          ×
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {formData.recipientType === 'all' && (
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  This will send the email to all {users.length} active users in the system.
                </AlertDescription>
              </Alert>
            )}

            {/* Template Variables */}
            {selectedTemplate && selectedTemplate.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Template Variables *</Label>
                <div className="space-y-3 border rounded-md p-4 bg-muted/50">
                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable} className="space-y-1">
                      <Label htmlFor={`var-${variable}`} className="text-sm">
                        {variable}
                      </Label>
                      <Input
                        id={`var-${variable}`}
                        value={formData.variables[variable] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            variables: {
                              ...formData.variables,
                              [variable]: e.target.value,
                            },
                          })
                        }
                        placeholder={`Enter value for ${variable}`}
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recipients Summary */}
            {recipients.length > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Ready to send to <strong>{recipients.length}</strong> recipient
                  {recipients.length !== 1 ? 's' : ''}
                </AlertDescription>
              </Alert>
            )}

            {/* Send Result */}
            {sendResult && (
              <Alert className={sendResult.failed === 0 ? 'border-green-500' : 'border-yellow-500'}>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Bulk email sent!</p>
                    <p className="text-sm">
                      Successfully sent: {sendResult.sent} / {sendResult.total}
                    </p>
                    {sendResult.failed > 0 && (
                      <p className="text-sm text-yellow-600">
                        Failed: {sendResult.failed}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Warning */}
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will send real emails to all selected recipients.
                Make sure you have reviewed the template and recipient list carefully.
              </AlertDescription>
            </Alert>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSending || recipients.length === 0 || !formData.templateKey}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

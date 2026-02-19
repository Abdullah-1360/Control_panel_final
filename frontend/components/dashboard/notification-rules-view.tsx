'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Bell, Plus, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface NotificationRule {
  id: string
  name: string
  description: string | null
  trigger: string
  templateKey: string
  recipientType: string
  recipientValue: any
  conditions: any
  priority: number
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface EmailTemplate {
  key: string
  name: string
}

const TRIGGERS = [
  { value: 'USER_CREATED', label: 'User Created' },
  { value: 'USER_UPDATED', label: 'User Updated' },
  { value: 'USER_DELETED', label: 'User Deleted' },
  { value: 'USER_ACTIVATED', label: 'User Activated' },
  { value: 'USER_DEACTIVATED', label: 'User Deactivated' },
  { value: 'USER_ROLE_CHANGED', label: 'User Role Changed' },
  { value: 'USER_LOCKED', label: 'User Locked' },
  { value: 'USER_UNLOCKED', label: 'User Unlocked' },
  { value: 'USER_LOGIN', label: 'User Login' },
  { value: 'USER_LOGOUT', label: 'User Logout' },
  { value: 'PASSWORD_CHANGED', label: 'Password Changed' },
  { value: 'PASSWORD_RESET_REQUESTED', label: 'Password Reset Requested' },
  { value: 'MFA_ENABLED', label: 'MFA Enabled' },
  { value: 'MFA_DISABLED', label: 'MFA Disabled' },
  { value: 'FAILED_LOGIN_ATTEMPT', label: 'Failed Login Attempt' },
  { value: 'SESSION_CREATED', label: 'Session Created' },
  { value: 'SESSION_REVOKED', label: 'Session Revoked' },
  { value: 'SETTINGS_CHANGED', label: 'Settings Changed' },
]

const RECIPIENT_TYPES = [
  { value: 'AFFECTED_USER', label: 'Affected User', description: 'User who triggered the event' },
  { value: 'SPECIFIC_USER', label: 'Specific Users', description: 'Select individual users' },
  { value: 'SPECIFIC_ROLE', label: 'Specific Roles', description: 'All users with selected roles' },
  { value: 'ALL_USERS', label: 'All Users', description: 'All active users' },
  { value: 'CUSTOM_EMAIL', label: 'Custom Emails', description: 'Enter email addresses' },
  { value: 'HYBRID', label: 'Hybrid', description: 'Combine multiple recipient types' },
]

export function NotificationRulesView() {
  const { toast } = useToast()
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: '',
    templateKey: '',
    recipientType: '',
    recipientValue: {
      userIds: [] as string[],
      roleIds: [] as string[],
      emails: [] as string[],
    },
    conditions: {},
    priority: 5,
    isActive: true,
  })

  const [emailInput, setEmailInput] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [rulesRes, templatesRes, usersRes, rolesRes] = await Promise.all([
        apiClient.getNotificationRules(),
        apiClient.getEmailTemplates(),
        apiClient.getUsers({ limit: 1000 }),
        apiClient.getRoles(),
      ])
      setRules(rulesRes.data)
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

  const handleCreate = () => {
    setEditingRule(null)
    setFormData({
      name: '',
      description: '',
      trigger: '',
      templateKey: '',
      recipientType: '',
      recipientValue: {
        userIds: [],
        roleIds: [],
        emails: [],
      },
      conditions: {},
      priority: 5,
      isActive: true,
    })
    setEmailInput('')
    setIsDialogOpen(true)
  }

  const handleEdit = (rule: NotificationRule) => {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      description: rule.description || '',
      trigger: rule.trigger,
      templateKey: rule.templateKey,
      recipientType: rule.recipientType,
      recipientValue: rule.recipientValue || {
        userIds: [],
        roleIds: [],
        emails: [],
      },
      conditions: rule.conditions || {},
      priority: rule.priority,
      isActive: rule.isActive,
    })
    setEmailInput(rule.recipientValue?.emails?.join(', ') || '')
    setIsDialogOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Parse emails from comma-separated string
      const emails = emailInput
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0)

      const data = {
        ...formData,
        recipientValue: {
          ...formData.recipientValue,
          emails,
        },
      }

      if (editingRule) {
        await apiClient.updateNotificationRule(editingRule.id, data)
        toast({
          title: 'Success',
          description: 'Notification rule updated successfully',
        })
      } else {
        await apiClient.createNotificationRule(data)
        toast({
          title: 'Success',
          description: 'Notification rule created successfully',
        })
      }

      setIsDialogOpen(false)
      loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save notification rule',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification rule?')) {
      return
    }

    setIsDeleting(true)
    try {
      await apiClient.deleteNotificationRule(id)
      toast({
        title: 'Success',
        description: 'Notification rule deleted successfully',
      })
      loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete notification rule',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleActive = async (rule: NotificationRule) => {
    try {
      await apiClient.updateNotificationRule(rule.id, {
        isActive: !rule.isActive,
      })
      toast({
        title: 'Success',
        description: `Rule ${!rule.isActive ? 'enabled' : 'disabled'} successfully`,
      })
      loadData()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rule',
        variant: 'destructive',
      })
    }
  }

  const getTriggerLabel = (trigger: string) => {
    return TRIGGERS.find((t) => t.value === trigger)?.label || trigger
  }

  const getRecipientTypeLabel = (type: string) => {
    return RECIPIENT_TYPES.find((t) => t.value === type)?.label || type
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Rules
              </CardTitle>
              <CardDescription>
                Configure automated email notifications for system events
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Rules are executed in priority order (1-10, highest first). Multiple rules can trigger for the same event.
            </AlertDescription>
          </Alert>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No notification rules found. Create your first rule to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rule.name}
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTriggerLabel(rule.trigger)}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs">{rule.templateKey}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getRecipientTypeLabel(rule.recipientType)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggleActive(rule)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(rule)}
                          title="Edit rule"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
                          disabled={isDeleting}
                          title="Delete rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Notification Rule' : 'Create Notification Rule'}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? 'Update the notification rule details below'
                : 'Create a new automated notification rule'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Rule Name *</Label>
                <Input
                  id="rule-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Welcome Email for New Users"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-priority">Priority (1-10) *</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  required
                />
                <p className="text-xs text-muted-foreground">Higher priority rules execute first</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Send welcome email when a new user is created"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-trigger">Trigger Event *</Label>
                <Select
                  value={formData.trigger}
                  onValueChange={(value) => setFormData({ ...formData, trigger: value })}
                >
                  <SelectTrigger id="rule-trigger">
                    <SelectValue placeholder="Select trigger event" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value}>
                        {trigger.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-template">Email Template *</Label>
                <Select
                  value={formData.templateKey}
                  onValueChange={(value) => setFormData({ ...formData, templateKey: value })}
                >
                  <SelectTrigger id="rule-template">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-recipient-type">Recipient Type *</Label>
              <Select
                value={formData.recipientType}
                onValueChange={(value) => setFormData({ ...formData, recipientType: value })}
              >
                <SelectTrigger id="rule-recipient-type">
                  <SelectValue placeholder="Select recipient type" />
                </SelectTrigger>
                <SelectContent>
                  {RECIPIENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recipient Configuration */}
            {(formData.recipientType === 'SPECIFIC_USER' || formData.recipientType === 'HYBRID') && (
              <div className="space-y-2">
                <Label>Specific Users</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!formData.recipientValue.userIds.includes(value)) {
                      setFormData({
                        ...formData,
                        recipientValue: {
                          ...formData.recipientValue,
                          userIds: [...formData.recipientValue.userIds, value],
                        },
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
                  {formData.recipientValue.userIds.map((userId) => {
                    const user = users.find((u) => u.id === userId)
                    return (
                      <Badge key={userId} variant="secondary">
                        {user?.username}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              recipientValue: {
                                ...formData.recipientValue,
                                userIds: formData.recipientValue.userIds.filter((id) => id !== userId),
                              },
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

            {(formData.recipientType === 'SPECIFIC_ROLE' || formData.recipientType === 'HYBRID') && (
              <div className="space-y-2">
                <Label>Specific Roles</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!formData.recipientValue.roleIds.includes(value)) {
                      setFormData({
                        ...formData,
                        recipientValue: {
                          ...formData.recipientValue,
                          roleIds: [...formData.recipientValue.roleIds, value],
                        },
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
                        {role.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.recipientValue.roleIds.map((roleId) => {
                    const role = roles.find((r) => r.id === roleId)
                    return (
                      <Badge key={roleId} variant="secondary">
                        {role?.displayName}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              recipientValue: {
                                ...formData.recipientValue,
                                roleIds: formData.recipientValue.roleIds.filter((id) => id !== roleId),
                              },
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

            {(formData.recipientType === 'CUSTOM_EMAIL' || formData.recipientType === 'HYBRID') && (
              <div className="space-y-2">
                <Label htmlFor="rule-emails">Custom Email Addresses</Label>
                <Input
                  id="rule-emails"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="user1@example.com, user2@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated email addresses
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="rule-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="rule-active">Enable this rule</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingRule ? 'Update Rule' : 'Create Rule'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

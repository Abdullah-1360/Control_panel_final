'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiClient } from '@/lib/api/client'
import { Mail, Plus, Edit, Trash2, Eye, Loader2, AlertCircle, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EmailTemplate {
  key: string
  name: string
  subject: string
  htmlBody: string
  textBody: string
  variables: string[]
}

export function EmailTemplatesView() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null)

  const [formData, setFormData] = useState<EmailTemplate>({
    key: '',
    name: '',
    subject: '',
    htmlBody: '',
    textBody: '',
    variables: [],
  })
  const [variableInput, setVariableInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testEmailDialog, setTestEmailDialog] = useState(false)
  const [testEmailData, setTestEmailData] = useState<{
    template: EmailTemplate | null
    to: string
    variables: Record<string, string>
  }>({
    template: null,
    to: '',
    variables: {},
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await apiClient.getEmailTemplates()
      setTemplates(response.data)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load email templates',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingTemplate(null)
    setFormData({
      key: '',
      name: '',
      subject: '',
      htmlBody: '',
      textBody: '',
      variables: [],
    })
    setVariableInput('')
    setIsDialogOpen(true)
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setFormData(template)
    setVariableInput(template.variables.join(', '))
    setIsDialogOpen(true)
  }

  const handlePreview = (template: EmailTemplate) => {
    setPreviewTemplate(template)
    setIsPreviewOpen(true)
  }

  const handleSendTest = (template: EmailTemplate) => {
    // Initialize variables object with empty strings
    const variables: Record<string, string> = {}
    template.variables.forEach((variable) => {
      variables[variable] = ''
    })

    setTestEmailData({
      template,
      to: '',
      variables,
    })
    setTestEmailDialog(true)
  }

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testEmailData.template) return

    setIsSendingTest(true)
    try {
      // In a real implementation, you would call an API endpoint like:
      // await apiClient.sendTemplateEmail(testEmailData.template.key, testEmailData.to, testEmailData.variables)
      
      // For now, show a message that this feature needs backend implementation
      toast({
        title: 'Feature Not Yet Implemented',
        description: 'The backend endpoint for sending template emails needs to be added. Template is ready to use!',
        variant: 'default',
      })
      
      setTestEmailDialog(false)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test email',
        variant: 'destructive',
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Parse variables from comma-separated string
      const variables = variableInput
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0)

      const data = {
        ...formData,
        variables,
      }

      if (editingTemplate) {
        // Update existing template
        const { key, ...updateData } = data
        await apiClient.updateEmailTemplate(editingTemplate.key, updateData)
        toast({
          title: 'Success',
          description: 'Email template updated successfully',
        })
      } else {
        // Create new template
        await apiClient.createEmailTemplate(data)
        toast({
          title: 'Success',
          description: 'Email template created successfully',
        })
      }

      setIsDialogOpen(false)
      loadTemplates()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save email template',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure you want to delete this email template?')) {
      return
    }

    setIsDeleting(true)
    try {
      await apiClient.deleteEmailTemplate(key)
      toast({
        title: 'Success',
        description: 'Email template deleted successfully',
      })
      loadTemplates()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete email template',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Templates
              </CardTitle>
              <CardDescription>
                Manage email templates for system notifications
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Use variables in format <code className="bg-muted px-1 py-0.5 rounded">{'{{variableName}}'}</code> in subject and body.
              System templates cannot be modified or deleted.
            </AlertDescription>
          </Alert>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No email templates found. Create your first template to get started.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.key}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs">{template.key}</code>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{template.subject}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="secondary" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendTest(template)}
                          title="Send test email"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(template)}
                          title="Preview template"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                          title="Edit template"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.key)}
                          disabled={isDeleting}
                          title="Delete template"
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
              {editingTemplate ? 'Edit Email Template' : 'Create Email Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update the email template details below'
                : 'Create a new email template for system notifications'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-key">Template Key *</Label>
                <Input
                  id="template-key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="welcome_email"
                  required
                  disabled={!!editingTemplate}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier (cannot be changed after creation)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Welcome Email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-subject">Email Subject *</Label>
              <Input
                id="template-subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Welcome to {{appName}}, {{userName}}!"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-variables">Variables (comma-separated)</Label>
              <Input
                id="template-variables"
                value={variableInput}
                onChange={(e) => setVariableInput(e.target.value)}
                placeholder="userName, appName, actionUrl"
              />
              <p className="text-xs text-muted-foreground">
                Variables that can be used in subject and body (e.g., userName, email)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-html">HTML Body *</Label>
              <Textarea
                id="template-html"
                value={formData.htmlBody}
                onChange={(e) => setFormData({ ...formData, htmlBody: e.target.value })}
                placeholder="<h1>Welcome {{userName}}</h1><p>Thank you for joining {{appName}}!</p>"
                rows={8}
                required
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-text">Plain Text Body *</Label>
              <Textarea
                id="template-text"
                value={formData.textBody}
                onChange={(e) => setFormData({ ...formData, textBody: e.target.value })}
                placeholder="Welcome {{userName}}\n\nThank you for joining {{appName}}!"
                rows={6}
                required
                className="font-mono text-sm"
              />
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
                  editingTemplate ? 'Update Template' : 'Create Template'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Template Preview</DialogTitle>
            <DialogDescription>
              Preview of {previewTemplate?.name}
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Subject:</Label>
                <p className="mt-1 text-sm">{previewTemplate.subject}</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Variables:</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {previewTemplate.variables.map((variable) => (
                    <Badge key={variable} variant="secondary">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">HTML Preview:</Label>
                <div
                  className="mt-1 border rounded-md p-4 bg-white text-black"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.htmlBody }}
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Plain Text:</Label>
                <pre className="mt-1 border rounded-md p-4 bg-muted text-sm whitespace-pre-wrap">
                  {previewTemplate.textBody}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Test Email Dialog */}
      <Dialog open={testEmailDialog} onOpenChange={setTestEmailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
            <DialogDescription>
              Send a test email using the template: {testEmailData.template?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendTestEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email-to">Recipient Email *</Label>
              <Input
                id="test-email-to"
                type="email"
                value={testEmailData.to}
                onChange={(e) => setTestEmailData({ ...testEmailData, to: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>

            {testEmailData.template && testEmailData.template.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Template Variables</Label>
                <div className="space-y-2 border rounded-md p-4 bg-muted/50">
                  {testEmailData.template.variables.map((variable) => (
                    <div key={variable} className="space-y-1">
                      <Label htmlFor={`var-${variable}`} className="text-sm">
                        {variable}
                      </Label>
                      <Input
                        id={`var-${variable}`}
                        value={testEmailData.variables[variable] || ''}
                        onChange={(e) =>
                          setTestEmailData({
                            ...testEmailData,
                            variables: {
                              ...testEmailData.variables,
                              [variable]: e.target.value,
                            },
                          })
                        }
                        placeholder={`Enter value for ${variable}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will send a real email to the specified address using the template with the provided variables.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTestEmailDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSendingTest}>
                {isSendingTest ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

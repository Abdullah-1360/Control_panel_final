'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { apiClient } from '@/lib/api/client'
import { Mail, Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SmtpSettings {
  host: string
  port: number
  username: string
  password?: string
  fromAddress: string
  fromName: string
  secure: boolean
  isConfigured: boolean
}

export function SmtpSettingsView() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<SmtpSettings>({
    host: '',
    port: 587,
    username: '',
    password: '', // Always string, never undefined
    fromAddress: '',
    fromName: 'OpsManager',
    secure: true,
    isConfigured: false,
  })
  const [testEmail, setTestEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await apiClient.getSmtpSettings()
      // Ensure password is always a string (empty if not returned)
      setSettings({
        ...data,
        password: '', // Don't populate password field for security
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load SMTP settings',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      // Exclude isConfigured from the request (it's a computed field)
      const { isConfigured, ...settingsToSave } = settings
      const updated = await apiClient.updateSmtpSettings(settingsToSave)
      setSettings(updated)
      toast({
        title: 'Success',
        description: 'SMTP settings saved successfully',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save SMTP settings',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testEmail) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      })
      return
    }

    setIsTesting(true)
    try {
      const result = await apiClient.testSmtpSettings(testEmail)
      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        })
        setTestEmail('')
      } else {
        toast({
          title: 'Test Failed',
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send test email',
        variant: 'destructive',
      })
    } finally {
      setIsTesting(false)
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
            <Mail className="h-5 w-5" />
            SMTP Configuration
          </CardTitle>
          <CardDescription>
            Configure email server settings for sending notifications and alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {settings.isConfigured && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  SMTP is currently configured and active
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTP Host *</Label>
                <Input
                  id="smtp-host"
                  type="text"
                  value={settings.host}
                  onChange={(e) => setSettings({ ...settings, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-port">SMTP Port *</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  value={settings.port}
                  onChange={(e) => setSettings({ ...settings, port: parseInt(e.target.value) || 587 })}
                  placeholder="587"
                  min="1"
                  max="65535"
                  required
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-username">Username</Label>
                <Input
                  id="smtp-username"
                  type="text"
                  value={settings.username}
                  onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                  placeholder="user@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty if authentication is not required
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-password">Password</Label>
                <Input
                  id="smtp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={settings.password}
                  onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                  placeholder="••••••••"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to keep existing password
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-from-address">From Email Address *</Label>
                <Input
                  id="smtp-from-address"
                  type="email"
                  value={settings.fromAddress}
                  onChange={(e) => setSettings({ ...settings, fromAddress: e.target.value })}
                  placeholder="noreply@opsmanager.local"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-from-name">From Name *</Label>
                <Input
                  id="smtp-from-name"
                  type="text"
                  value={settings.fromName}
                  onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                  placeholder="OpsManager"
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="smtp-secure"
                checked={settings.secure}
                onCheckedChange={(checked) => setSettings({ ...settings, secure: checked })}
              />
              <Label htmlFor="smtp-secure" className="cursor-pointer">
                Use TLS/SSL (recommended for port 587 or 465)
              </Label>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                SMTP credentials are encrypted before being stored in the database
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save SMTP Settings'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Email Configuration
          </CardTitle>
          <CardDescription>
            Send a test email to verify your SMTP settings are working correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Recipient Email Address</Label>
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                A test email will be sent to this address
              </p>
            </div>

            <Button type="submit" variant="outline" disabled={isTesting || !settings.isConfigured}>
              {isTesting ? (
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

            {!settings.isConfigured && (
              <p className="text-sm text-muted-foreground">
                Save SMTP settings first before sending a test email
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

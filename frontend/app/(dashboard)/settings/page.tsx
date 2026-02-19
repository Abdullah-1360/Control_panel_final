'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/lib/auth/store'
import { apiClient } from '@/lib/api/client'
import { Shield, Key, QrCode, Copy, Check, Eye, EyeOff, AlertCircle, CheckCircle2, Info, Mail } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'
import { SmtpSettingsView } from '@/components/dashboard/smtp-settings-view'
import { EmailTemplatesView } from '@/components/dashboard/email-templates-view'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { toast } = useToast()
  
  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  // MFA Setup State
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([])
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false)
  const [mfaSetupStep, setMfaSetupStep] = useState<'initial' | 'verify' | 'complete'>('initial')
  const [copiedCodes, setCopiedCodes] = useState(false)
  
  // MFA Disable State
  const [disableMfaPassword, setDisableMfaPassword] = useState('')
  const [disableMfaCode, setDisableMfaCode] = useState('')
  const [isDisablingMfa, setIsDisablingMfa] = useState(false)
  
  // Password Strength Calculation
  const calculatePasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 12) strength++
    if (password.length >= 16) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++
    
    return strength
  }
  
  const getPasswordStrengthLabel = (strength: number) => {
    if (strength <= 2) return { label: 'Weak', color: 'bg-red-500' }
    if (strength <= 4) return { label: 'Medium', color: 'bg-yellow-500' }
    return { label: 'Strong', color: 'bg-green-500' }
  }
  
  const passwordStrength = calculatePasswordStrength(newPassword)
  const strengthInfo = getPasswordStrengthLabel(passwordStrength)
  
  // Password Policy Checks
  const passwordPolicyChecks = [
    { label: 'At least 12 characters', met: newPassword.length >= 12 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'Contains lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'Contains number', met: /[0-9]/.test(newPassword) },
    { label: 'Contains special character', met: /[^a-zA-Z0-9]/.test(newPassword) },
  ]
  
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      })
      return
    }
    
    if (!passwordPolicyChecks.every(check => check.met)) {
      toast({
        title: 'Error',
        description: 'Password does not meet policy requirements',
        variant: 'destructive',
      })
      return
    }
    
    setIsChangingPassword(true)
    try {
      await apiClient.changePassword(currentPassword, newPassword, confirmPassword)
      toast({
        title: 'Success',
        description: 'Password changed successfully',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password',
        variant: 'destructive',
      })
    } finally {
      setIsChangingPassword(false)
    }
  }
  
  const handleMfaSetup = async () => {
    setIsSettingUpMfa(true)
    try {
      const response = await apiClient.setupMfa()
      setMfaSecret(response.secret)
      setMfaQrCode(response.qrCode)
      setMfaBackupCodes(response.backupCodes)
      setMfaSetupStep('verify')
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to setup MFA',
        variant: 'destructive',
      })
    } finally {
      setIsSettingUpMfa(false)
    }
  }
  
  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSettingUpMfa(true)
    try {
      await apiClient.verifyMfa(mfaVerifyCode)
      setMfaSetupStep('complete')
      toast({
        title: 'Success',
        description: 'MFA enabled successfully',
      })
      // Refresh user data
      window.location.reload()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Invalid verification code',
        variant: 'destructive',
      })
    } finally {
      setIsSettingUpMfa(false)
    }
  }
  
  const handleMfaDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsDisablingMfa(true)
    try {
      await apiClient.disableMfa(disableMfaPassword, disableMfaCode)
      toast({
        title: 'Success',
        description: 'MFA disabled successfully',
      })
      setDisableMfaPassword('')
      setDisableMfaCode('')
      // Refresh user data
      window.location.reload()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disable MFA',
        variant: 'destructive',
      })
    } finally {
      setIsDisablingMfa(false)
    }
  }
  
  const copyBackupCodes = () => {
    navigator.clipboard.writeText(mfaBackupCodes.join('\n'))
    setCopiedCodes(true)
    setTimeout(() => setCopiedCodes(false), 2000)
    toast({
      title: 'Copied',
      description: 'Backup codes copied to clipboard',
    })
  }
  
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account security and authentication preferences</p>
      </div>
      
      <Tabs defaultValue="password" className="space-y-6">
        <TabsList className={`grid w-full max-w-2xl ${user?.role?.name === 'SUPER_ADMIN' ? 'grid-cols-4' : 'grid-cols-2'}`}>
          <TabsTrigger value="password" className="gap-2">
            <Key className="h-4 w-4" />
            Password
          </TabsTrigger>
          <TabsTrigger value="mfa" className="gap-2">
            <Shield className="h-4 w-4" />
            Two-Factor Auth
          </TabsTrigger>
          {user?.role?.name === 'SUPER_ADMIN' && (
            <>
              <TabsTrigger value="smtp" className="gap-2">
                <Mail className="h-4 w-4" />
                SMTP
              </TabsTrigger>
              <TabsTrigger value="email-templates" className="gap-2">
                <Mail className="h-4 w-4" />
                Templates
              </TabsTrigger>
            </>
          )}
        </TabsList>
        
        {/* Password Change Tab */}
        <TabsContent value="password" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure. Use a strong, unique password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  
                  {newPassword && (
                    <div className="space-y-3 mt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${strengthInfo.color} transition-all duration-300`}
                            style={{ width: `${(passwordStrength / 6) * 100}%` }}
                          />
                        </div>
                        <Badge variant="outline" className="text-xs font-medium">
                          {strengthInfo.label}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Password Requirements
                        </p>
                        <div className="grid gap-2">
                          {passwordPolicyChecks.map((check, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              {check.met ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span className={check.met ? 'text-foreground' : 'text-muted-foreground'}>
                                {check.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Passwords do not match
                    </p>
                  )}
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Changing your password will log you out of all other active sessions for security.
                  </AlertDescription>
                </Alert>
                
                <Button type="submit" disabled={isChangingPassword} className="w-full sm:w-auto">
                  {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* MFA Tab */}
        <TabsContent value="mfa" className="space-y-6">
          {!user?.mfaEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Enable Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account with TOTP-based authentication
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mfaSetupStep === 'initial' && (
                  <div className="space-y-4">
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        Two-factor authentication (2FA) significantly improves your account security by requiring a code from your phone in addition to your password when signing in.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                      <p className="font-medium text-sm">What you'll need:</p>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>An authenticator app (Google Authenticator, Authy, 1Password, etc.)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>A few minutes to complete the setup</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>A safe place to store backup codes</span>
                        </li>
                      </ul>
                    </div>
                    
                    <Button onClick={handleMfaSetup} disabled={isSettingUpMfa} className="w-full sm:w-auto">
                      {isSettingUpMfa ? 'Setting up...' : 'Begin Setup'}
                    </Button>
                  </div>
                )}
                
                {mfaSetupStep === 'verify' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          1
                        </div>
                        <h3 className="font-semibold">Scan QR Code</h3>
                      </div>
                      <p className="text-sm text-muted-foreground ml-10">
                        Open your authenticator app and scan this QR code
                      </p>
                      {mfaQrCode && (
                        <div className="ml-10 flex justify-center p-6 bg-white rounded-lg border-2 border-border w-fit">
                          <Image src={mfaQrCode} alt="MFA QR Code" width={200} height={200} />
                        </div>
                      )}
                      <div className="ml-10 p-4 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Can't scan? Enter this code manually:</p>
                        <code className="text-sm font-mono bg-background px-3 py-2 rounded border block break-all">{mfaSecret}</code>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          2
                        </div>
                        <h3 className="font-semibold">Save Backup Codes</h3>
                      </div>
                      <Alert className="ml-10">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Store these backup codes in a safe place. You can use them to access your account if you lose your phone.
                        </AlertDescription>
                      </Alert>
                      <div className="ml-10 space-y-3">
                        <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-lg">
                          {mfaBackupCodes.map((code, index) => (
                            <code key={index} className="text-sm font-mono bg-background px-3 py-2 rounded border text-center">
                              {code}
                            </code>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={copyBackupCodes}
                          className="w-full"
                        >
                          {copiedCodes ? (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy All Codes
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <form onSubmit={handleMfaVerify} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          3
                        </div>
                        <h3 className="font-semibold">Verify Setup</h3>
                      </div>
                      <div className="ml-10 space-y-2">
                        <Label htmlFor="verify-code">Enter the 6-digit code from your authenticator app</Label>
                        <Input
                          id="verify-code"
                          type="text"
                          maxLength={6}
                          value={mfaVerifyCode}
                          onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          className="text-center text-lg tracking-widest font-mono"
                          required
                        />
                      </div>
                      
                      <div className="ml-10">
                        <Button type="submit" disabled={isSettingUpMfa || mfaVerifyCode.length !== 6} className="w-full sm:w-auto">
                          {isSettingUpMfa ? 'Verifying...' : 'Enable Two-Factor Authentication'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
                
                {mfaSetupStep === 'complete' && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Two-factor authentication has been enabled successfully! Your account is now more secure.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  Two-Factor Authentication Enabled
                </CardTitle>
                <CardDescription>
                  Your account is protected with two-factor authentication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription>
                      Two-factor authentication is currently active on your account. You'll need to enter a code from your authenticator app when signing in.
                    </AlertDescription>
                  </Alert>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-semibold mb-4">Disable Two-Factor Authentication</h3>
                    <form onSubmit={handleMfaDisable} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="disable-password">Confirm Your Password</Label>
                        <Input
                          id="disable-password"
                          type="password"
                          value={disableMfaPassword}
                          onChange={(e) => setDisableMfaPassword(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="disable-code">Authentication Code</Label>
                        <Input
                          id="disable-code"
                          type="text"
                          maxLength={8}
                          value={disableMfaCode}
                          onChange={(e) => setDisableMfaCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 6-digit code or backup code"
                          className="font-mono"
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter the 6-digit code from your authenticator app or use a backup code
                        </p>
                      </div>
                      
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Warning: Disabling two-factor authentication will make your account less secure. Only disable if absolutely necessary.
                        </AlertDescription>
                      </Alert>
                      
                      <Button type="submit" variant="destructive" disabled={isDisablingMfa}>
                        {isDisablingMfa ? 'Disabling...' : 'Disable Two-Factor Authentication'}
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* SMTP Settings Tab (SUPER_ADMIN only) */}
        {user?.role?.name === 'SUPER_ADMIN' && (
          <TabsContent value="smtp" className="space-y-6">
            <SmtpSettingsView />
          </TabsContent>
        )}

        {/* Email Templates Tab (SUPER_ADMIN only) */}
        {user?.role?.name === 'SUPER_ADMIN' && (
          <TabsContent value="email-templates" className="space-y-6">
            <EmailTemplatesView />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

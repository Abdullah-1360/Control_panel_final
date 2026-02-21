"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  X,
  Plus,
  AlertCircle,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCreateServer, useUpdateServer, useServer } from "@/hooks/use-servers"
import type { Server, CreateServerInput, UpdateServerInput } from "@/lib/types/server"
import { toast } from "sonner"

// Form validation schema
const serverFormSchema = z.object({
  // Identity
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  environment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  
  // Connection
  platformType: z.enum(["LINUX", "WINDOWS"]),
  host: z.string().min(1, "Host is required").refine(
    (val) => {
      // IP address or hostname validation
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
      const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
      return ipRegex.test(val) || hostnameRegex.test(val)
    },
    "Must be a valid IP address or hostname"
  ),
  port: z.coerce.number().int().min(1, "Port must be at least 1").max(65535, "Port must be at most 65535"),
  connectionProtocol: z.string().default("SSH"),
  username: z.string().min(1, "Username is required"),
  
  // Authentication
  authType: z.enum(["SSH_KEY", "SSH_KEY_WITH_PASSPHRASE", "PASSWORD"]),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  password: z.string().optional(),
  
  // Privilege
  privilegeMode: z.enum(["ROOT", "SUDO", "USER_ONLY"]),
  sudoMode: z.enum(["NONE", "NOPASSWD", "PASSWORD_REQUIRED"]),
  sudoPassword: z.string().optional(),
  
  // Host Key Verification
  hostKeyStrategy: z.enum(["STRICT_PINNED", "TOFU", "DISABLED"]),
  knownHostFingerprints: z.array(z.object({
    keyType: z.string(),
    fingerprint: z.string(),
  })).optional(),
  
  // Metrics Configuration
  metricsEnabled: z.boolean().optional(),
  metricsInterval: z.coerce.number().min(60).max(3600).optional(),
  alertCpuThreshold: z.coerce.number().min(1).max(100).optional(),
  alertRamThreshold: z.coerce.number().min(1).max(100).optional(),
  alertDiskThreshold: z.coerce.number().min(1).max(100).optional(),
  isEditMode: z.boolean().optional(), // Add flag to track edit mode
}).refine((data) => {
  // Skip credential validation in edit mode (credentials are optional when updating)
  if (data.isEditMode) {
    return true;
  }
  
  // Validate auth type requirements only in create mode
  if (data.authType === "SSH_KEY" && !data.privateKey) {
    return false
  }
  if (data.authType === "SSH_KEY_WITH_PASSPHRASE" && (!data.privateKey || !data.passphrase)) {
    return false
  }
  if (data.authType === "PASSWORD" && !data.password) {
    return false
  }
  return true
}, {
  message: "Required credentials missing for selected auth type",
  path: ["authType"],
})

type ServerFormValues = z.infer<typeof serverFormSchema>

interface ServerFormDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverId?: string // If provided, edit mode
  onSuccess?: (server: any) => void
}

export function ServerFormDrawer({ open, onOpenChange, serverId, onSuccess }: ServerFormDrawerProps) {
  const isEditMode = !!serverId
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [showPassphrase, setShowPassphrase] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showSudoPassword, setShowSudoPassword] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Collapsible sections state
  const [openSections, setOpenSections] = useState({
    identity: true,
    connection: false,
    authentication: false,
    privilege: false,
    hostKey: false,
    metrics: false,
  })

  const { data: serverData } = useServer(serverId || "", { enabled: isEditMode })
  const createMutation = useCreateServer()
  const updateMutation = useUpdateServer()

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverFormSchema),
    defaultValues: {
      name: "",
      environment: "",
      tags: [],
      notes: "",
      platformType: "LINUX",
      host: "",
      port: 22,
      connectionProtocol: "SSH",
      username: "root",
      authType: "SSH_KEY",
      privateKey: "",
      passphrase: "",
      password: "",
      privilegeMode: "ROOT",
      sudoMode: "NONE",
      sudoPassword: "",
      hostKeyStrategy: "TOFU",
      knownHostFingerprints: [],
      metricsEnabled: false,
      metricsInterval: 900, // 15 minutes default
      alertCpuThreshold: 90,
      alertRamThreshold: 95,
      alertDiskThreshold: 90,
      isEditMode: false, // Default to create mode
    },
  })

  // Load server data in edit mode
  useEffect(() => {
    if (isEditMode && serverData) {
      form.reset({
        name: serverData.name,
        environment: serverData.environment || "",
        tags: serverData.tags || [],
        notes: serverData.notes || "",
        platformType: serverData.platformType,
        host: serverData.host,
        port: Number(serverData.port) || 22, // Ensure port is a number
        connectionProtocol: serverData.connectionProtocol,
        username: serverData.username,
        authType: serverData.authType,
        privateKey: "", // Don't show existing credentials
        passphrase: "",
        password: "",
        privilegeMode: serverData.privilegeMode,
        sudoMode: serverData.sudoMode,
        sudoPassword: "",
        hostKeyStrategy: serverData.hostKeyStrategy,
        knownHostFingerprints: serverData.knownHostFingerprints.map(fp => ({
          keyType: fp.keyType,
          fingerprint: fp.fingerprint,
        })),
        metricsEnabled: serverData.metricsEnabled || false,
        metricsInterval: serverData.metricsInterval || 900,
        alertCpuThreshold: serverData.alertCpuThreshold || 90,
        alertRamThreshold: serverData.alertRamThreshold || 95,
        alertDiskThreshold: serverData.alertDiskThreshold || 90,
        isEditMode: true, // Set edit mode flag
      })
    } else if (!isEditMode && open) {
      // Reset to default values when opening in create mode
      form.reset({
        name: "",
        environment: "",
        tags: [],
        notes: "",
        platformType: "LINUX",
        host: "",
        port: 22,
        connectionProtocol: "SSH",
        username: "root",
        authType: "SSH_KEY",
        privateKey: "",
        passphrase: "",
        password: "",
        privilegeMode: "ROOT",
        sudoMode: "NONE",
        sudoPassword: "",
        hostKeyStrategy: "TOFU",
        knownHostFingerprints: [],
        metricsEnabled: false,
        metricsInterval: 900,
        alertCpuThreshold: 90,
        alertRamThreshold: 95,
        alertDiskThreshold: 90,
        isEditMode: false,
      })
    }
  }, [isEditMode, serverData, open, form])

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleAddTag = () => {
    if (tagInput.trim()) {
      const currentTags = form.getValues("tags") || []
      if (!currentTags.includes(tagInput.trim())) {
        form.setValue("tags", [...currentTags, tagInput.trim()])
        setTagInput("")
      }
    }
  }

  const handleRemoveTag = (tag: string) => {
    const currentTags = form.getValues("tags") || []
    form.setValue("tags", currentTags.filter(t => t !== tag))
  }

  const handleAddFingerprint = () => {
    const currentFingerprints = form.getValues("knownHostFingerprints") || []
    form.setValue("knownHostFingerprints", [
      ...currentFingerprints,
      { keyType: "ssh-rsa", fingerprint: "" }
    ])
  }

  const handleRemoveFingerprint = (index: number) => {
    const currentFingerprints = form.getValues("knownHostFingerprints") || []
    form.setValue("knownHostFingerprints", currentFingerprints.filter((_, i) => i !== index))
  }

  const onSubmit = async (values: ServerFormValues) => {
    setSuccessMessage(null)
    
    try {
      console.log('[ServerForm] Submitting with values:', { ...values, privateKey: values.privateKey ? '[REDACTED]' : undefined, password: values.password ? '[REDACTED]' : undefined });
      
      const credentials: any = {}
      let hasCredentials = false;
      
      if (values.authType === "SSH_KEY" || values.authType === "SSH_KEY_WITH_PASSPHRASE") {
        if (values.privateKey) {
          credentials.privateKey = values.privateKey;
          hasCredentials = true;
        }
        if (values.passphrase) {
          credentials.passphrase = values.passphrase;
          hasCredentials = true;
        }
      }
      
      if (values.authType === "PASSWORD" && values.password) {
        credentials.password = values.password;
        hasCredentials = true;
      }

      // Sanitize host: remove protocol if present
      const sanitizedHost = values.host
        .replace(/^https?:\/\//, '') // Remove http:// or https://
        .replace(/\/$/, ''); // Remove trailing slash

      if (isEditMode) {
        // Update mode: only send changed fields, exclude platformType
        const updatePayload: UpdateServerInput = {
          name: values.name,
          environment: values.environment || undefined,
          tags: values.tags || [],
          notes: values.notes || undefined,
          host: sanitizedHost,
          port: values.port,
          connectionProtocol: values.connectionProtocol,
          username: values.username,
          authType: values.authType,
          privilegeMode: values.privilegeMode,
          sudoMode: values.sudoMode,
          sudoPassword: values.sudoPassword || undefined,
          hostKeyStrategy: values.hostKeyStrategy,
          knownHostFingerprints: values.knownHostFingerprints?.filter(fp => fp.fingerprint) || [],
          metricsEnabled: values.metricsEnabled,
          metricsInterval: values.metricsInterval,
          alertCpuThreshold: values.alertCpuThreshold,
          alertRamThreshold: values.alertRamThreshold,
          alertDiskThreshold: values.alertDiskThreshold,
        };

        // Only include credentials if they were actually provided
        if (hasCredentials) {
          updatePayload.credentials = credentials;
        }

        console.log('[ServerForm] Update payload:', { ...updatePayload, credentials: hasCredentials ? '[REDACTED]' : undefined });
        const result = await updateMutation.mutateAsync({ id: serverId!, data: updatePayload })
        console.log('[ServerForm] Update successful:', result);
        setSuccessMessage(`Server "${values.name}" updated successfully!`)
        if (onSuccess) onSuccess(result)
      } else {
        // Create mode: include all fields including platformType
        const createPayload: CreateServerInput = {
          name: values.name,
          environment: values.environment || undefined,
          tags: values.tags || [],
          notes: values.notes || undefined,
          platformType: values.platformType,
          host: sanitizedHost,
          port: values.port,
          connectionProtocol: values.connectionProtocol,
          username: values.username,
          authType: values.authType,
          credentials: credentials, // Always send credentials in create mode
          privilegeMode: values.privilegeMode,
          sudoMode: values.sudoMode,
          sudoPassword: values.sudoPassword || undefined,
          hostKeyStrategy: values.hostKeyStrategy,
          knownHostFingerprints: values.knownHostFingerprints?.filter(fp => fp.fingerprint) || [],
          metricsEnabled: values.metricsEnabled,
          metricsInterval: values.metricsInterval,
          alertCpuThreshold: values.alertCpuThreshold,
          alertRamThreshold: values.alertRamThreshold,
          alertDiskThreshold: values.alertDiskThreshold,
        };

        console.log('[ServerForm] Create payload:', { ...createPayload, credentials: '[REDACTED]' });
        const result = await createMutation.mutateAsync(createPayload)
        console.log('[ServerForm] Create successful:', result);
        setSuccessMessage(`Server "${values.name}" created successfully!`)
        if (onSuccess) onSuccess(result)
        form.reset()
      }
    } catch (error: any) {
      console.error('[ServerForm] Submit error:', error);
      toast.error(error.message || "Failed to save server")
    }
  }

  const handleClose = () => {
    setSuccessMessage(null)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>{isEditMode ? "Edit Server" : "Add New Server"}</SheetTitle>
          <SheetDescription>
            {isEditMode 
              ? "Update server connection details and credentials"
              : "Configure a new server connection with SSH credentials"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
              {successMessage && (
                <Alert className="bg-success/10 border-success/20">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success">
                    {successMessage}
                  </AlertDescription>
                </Alert>
              )}

              {/* Identity Section */}
              <Collapsible open={openSections.identity} onOpenChange={() => toggleSection("identity")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2">
                    {openSections.identity ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-semibold text-sm">Identity</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Required</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Server Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="prod-web-01" {...field} />
                        </FormControl>
                        <FormDescription>Unique identifier for this server</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="environment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Environment</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select environment" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PROD">Production</SelectItem>
                            <SelectItem value="STAGING">Staging</SelectItem>
                            <SelectItem value="DEV">Development</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add tag..."
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  handleAddTag()
                                }
                              }}
                            />
                            <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {field.value && field.value.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {field.value.map((tag) => (
                                <Badge key={tag} variant="secondary" className="gap-1">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <FormDescription>Press Enter or click + to add tags</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes about this server..."
                            className="resize-none"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Connection Section */}
              <Collapsible open={openSections.connection} onOpenChange={() => toggleSection("connection")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2">
                    {openSections.connection ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-semibold text-sm">Connection</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Required</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="platformType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Platform *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LINUX">Linux</SelectItem>
                            <SelectItem value="WINDOWS">Windows</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="host"
                      render={({ field }) => (
                        <FormItem className="col-span-2 sm:col-span-1">
                          <FormLabel>Host *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="192.168.1.100 or server.example.com" 
                              {...field}
                              onChange={(e) => {
                                // Auto-sanitize: remove protocol and trailing slash
                                const sanitized = e.target.value
                                  .replace(/^https?:\/\//, '')
                                  .replace(/\/$/, '');
                                field.onChange(sanitized);
                              }}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Enter hostname or IP (protocols will be removed automatically)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem className="col-span-2 sm:col-span-1">
                          <FormLabel>Port *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="22" 
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value === '' ? '' : Number(value));
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username *</FormLabel>
                        <FormControl>
                          <Input placeholder="root" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Authentication Section */}
              <Collapsible open={openSections.authentication} onOpenChange={() => toggleSection("authentication")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2">
                    {openSections.authentication ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-semibold text-sm">Authentication</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Required</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="authType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Authentication Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SSH_KEY">SSH Key</SelectItem>
                            <SelectItem value="SSH_KEY_WITH_PASSPHRASE">SSH Key with Passphrase</SelectItem>
                            <SelectItem value="PASSWORD">Password</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(form.watch("authType") === "SSH_KEY" || form.watch("authType") === "SSH_KEY_WITH_PASSPHRASE") && (
                    <FormField
                      control={form.control}
                      name="privateKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Private Key *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Textarea
                                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                                className="resize-none font-mono text-xs"
                                rows={6}
                                {...field}
                                type={showPrivateKey ? "text" : "password"}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPrivateKey(!showPrivateKey)}
                                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                              >
                                {showPrivateKey ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            {isEditMode ? "Leave empty to keep existing key" : "Paste your SSH private key"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("authType") === "SSH_KEY_WITH_PASSPHRASE" && (
                    <FormField
                      control={form.control}
                      name="passphrase"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Passphrase *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassphrase ? "text" : "password"}
                                placeholder="Enter passphrase"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassphrase(!showPassphrase)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showPassphrase ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            {isEditMode ? "Leave empty to keep existing passphrase" : "Passphrase for the private key"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("authType") === "PASSWORD" && (
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter password"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            {isEditMode ? "Leave empty to keep existing password" : "SSH password for authentication"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Privilege Section */}
              <Collapsible open={openSections.privilege} onOpenChange={() => toggleSection("privilege")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2">
                    {openSections.privilege ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-semibold text-sm">Privilege Escalation</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Optional</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="privilegeMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Privilege Mode</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ROOT">Root (direct root login)</SelectItem>
                            <SelectItem value="SUDO">Sudo (escalate with sudo)</SelectItem>
                            <SelectItem value="USER_ONLY">User Only (no escalation)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>How to gain elevated privileges</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("privilegeMode") === "SUDO" && (
                    <>
                      <FormField
                        control={form.control}
                        name="sudoMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sudo Mode</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="NOPASSWD">NOPASSWD (no password required)</SelectItem>
                                <SelectItem value="PASSWORD_REQUIRED">Password Required</SelectItem>
                                <SelectItem value="NONE">None</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>Sudo password requirement</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.watch("sudoMode") === "PASSWORD_REQUIRED" && (
                        <FormField
                          control={form.control}
                          name="sudoPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sudo Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showSudoPassword ? "text" : "password"}
                                    placeholder="Enter sudo password"
                                    {...field}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowSudoPassword(!showSudoPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                  >
                                    {showSudoPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </FormControl>
                              <FormDescription>
                                {isEditMode ? "Leave empty to keep existing sudo password" : "Password for sudo commands"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Host Key Verification Section */}
              <Collapsible open={openSections.hostKey} onOpenChange={() => toggleSection("hostKey")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2">
                    {openSections.hostKey ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-semibold text-sm">Host Key Verification</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Optional</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="hostKeyStrategy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Verification Strategy</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="STRICT_PINNED">Strict Pinned (verify against known fingerprints)</SelectItem>
                            <SelectItem value="TOFU">Trust On First Use (accept first, verify after)</SelectItem>
                            <SelectItem value="DISABLED">Disabled (not recommended)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>How to verify server host keys</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("hostKeyStrategy") === "STRICT_PINNED" && (
                    <FormField
                      control={form.control}
                      name="knownHostFingerprints"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Known Host Fingerprints</FormLabel>
                          <div className="space-y-2">
                            {field.value && field.value.length > 0 ? (
                              field.value.map((fp, index) => (
                                <div key={index} className="flex gap-2">
                                  <Select
                                    value={fp.keyType}
                                    onValueChange={(value) => {
                                      const updated = [...field.value!]
                                      updated[index].keyType = value
                                      form.setValue("knownHostFingerprints", updated)
                                    }}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ssh-rsa">ssh-rsa</SelectItem>
                                      <SelectItem value="ssh-ed25519">ssh-ed25519</SelectItem>
                                      <SelectItem value="ecdsa-sha2-nistp256">ecdsa-sha2-nistp256</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    placeholder="SHA256:..."
                                    value={fp.fingerprint}
                                    onChange={(e) => {
                                      const updated = [...field.value!]
                                      updated[index].fingerprint = e.target.value
                                      form.setValue("knownHostFingerprints", updated)
                                    }}
                                    className="flex-1 font-mono text-xs"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleRemoveFingerprint(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            ) : (
                              <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  No fingerprints added. Add manually or run a connection test to auto-populate.
                                </AlertDescription>
                              </Alert>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleAddFingerprint}
                              className="w-full"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Fingerprint
                            </Button>
                          </div>
                          <FormDescription>
                            Add known host key fingerprints for verification
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Metrics Configuration Section */}
              <Collapsible open={openSections.metrics} onOpenChange={() => toggleSection("metrics")}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-accent/50 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-2">
                    {openSections.metrics ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-semibold text-sm">Metrics Configuration</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">Optional</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="metricsEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Enable Metrics Collection</FormLabel>
                          <FormDescription className="text-xs">
                            Automatically collect CPU, RAM, disk, and other system metrics
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("metricsEnabled") && (
                    <>
                      <FormField
                        control={form.control}
                        name="metricsInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Collection Interval</FormLabel>
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={field.value === 300 ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => form.setValue("metricsInterval", 300)}
                                >
                                  5 min
                                </Button>
                                <Button
                                  type="button"
                                  variant={field.value === 900 ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => form.setValue("metricsInterval", 900)}
                                >
                                  15 min
                                </Button>
                                <Button
                                  type="button"
                                  variant={field.value === 1800 ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => form.setValue("metricsInterval", 1800)}
                                >
                                  30 min
                                </Button>
                                <Button
                                  type="button"
                                  variant={field.value === 3600 ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => form.setValue("metricsInterval", 3600)}
                                >
                                  1 hour
                                </Button>
                              </div>
                              <FormControl>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    placeholder="Custom interval (seconds)"
                                    min={60}
                                    max={3600}
                                    {...field}
                                  />
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">seconds</span>
                                </div>
                              </FormControl>
                            </div>
                            <FormDescription>
                              How often to collect metrics (60-3600 seconds)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Alert Thresholds</span>
                        </div>

                        <FormField
                          control={form.control}
                          name="alertCpuThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPU Threshold</FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    {...field}
                                    className="w-24"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full transition-all",
                                        field.value >= 90 ? "bg-destructive" : field.value >= 70 ? "bg-warning" : "bg-primary"
                                      )}
                                      style={{ width: `${field.value}%` }}
                                    />
                                  </div>
                                </div>
                              </FormControl>
                              <FormDescription className="text-xs">
                                Alert when CPU usage exceeds this percentage
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="alertRamThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>RAM Threshold</FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    {...field}
                                    className="w-24"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full transition-all",
                                        field.value >= 95 ? "bg-destructive" : field.value >= 75 ? "bg-warning" : "bg-chart-2"
                                      )}
                                      style={{ width: `${field.value}%` }}
                                    />
                                  </div>
                                </div>
                              </FormControl>
                              <FormDescription className="text-xs">
                                Alert when RAM usage exceeds this percentage
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="alertDiskThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Disk Threshold</FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    {...field}
                                    className="w-24"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full transition-all",
                                        field.value >= 90 ? "bg-destructive" : field.value >= 70 ? "bg-warning" : "bg-success"
                                      )}
                                      style={{ width: `${field.value}%` }}
                                    />
                                  </div>
                                </div>
                              </FormControl>
                              <FormDescription className="text-xs">
                                Alert when disk usage exceeds this percentage
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {isEditMode && serverData?.metricsEnabled && !form.watch("metricsEnabled") && (
                        <Alert className="bg-warning/10 border-warning/20">
                          <AlertCircle className="h-4 w-4 text-warning" />
                          <AlertDescription className="text-xs text-warning">
                            Disabling metrics will stop automatic collection. Historical data will be preserved.
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </form>
          </Form>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background flex items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {Object.keys(form.formState.errors).length > 0 && (
              <span className="text-xs text-destructive">
                Please fix {Object.keys(form.formState.errors).length} validation error(s)
              </span>
            )}
            {successMessage && (
              <Button type="button" variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Server
              </Button>
            )}
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditMode ? "Update Server" : "Create Server"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

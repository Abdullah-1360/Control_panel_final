"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  ExternalLink,
  Copy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useServer, useServerTestHistory, useServerDependencies, useTestServerConnection } from "@/hooks/use-servers"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ServerFormDrawer } from "./server-form-drawer"
import { ServerMetricsTab } from "./server-metrics-tab"

interface ServerDetailTabsProps {
  serverId: string
}

export function ServerDetailTabs({ serverId }: ServerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [formOpen, setFormOpen] = useState(false)
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set())

  const { data: server, isLoading: serverLoading } = useServer(serverId)
  const { data: testHistory, isLoading: historyLoading } = useServerTestHistory(serverId)
  const { data: dependencies, isLoading: depsLoading } = useServerDependencies(serverId)
  const testMutation = useTestServerConnection()

  const handleTest = () => {
    testMutation.mutate({ id: serverId, async: true })
  }

  const toggleTestExpand = (testId: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev)
      if (next.has(testId)) {
        next.delete(testId)
      } else {
        next.add(testId)
      }
      return next
    })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  if (serverLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!server) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-sm font-medium text-foreground">Server not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="test-history">Test History</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl font-mono">{server.name}</CardTitle>
                  <CardDescription className="mt-1 font-mono">
                    {server.host}:{server.port}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={server.lastTestStatus === "OK" ? "default" : server.lastTestStatus === "FAILED" ? "destructive" : "secondary"}
                    className="gap-1.5"
                  >
                    {server.lastTestStatus === "OK" && <CheckCircle2 className="h-3 w-3" />}
                    {server.lastTestStatus === "FAILED" && <XCircle className="h-3 w-3" />}
                    {server.lastTestStatus === "NEVER_TESTED" && <Clock className="h-3 w-3" />}
                    {server.lastTestStatus === "OK" ? "Connected" : server.lastTestStatus === "FAILED" ? "Failed" : "Not Tested"}
                  </Badge>
                  <Button size="sm" onClick={handleTest} disabled={testMutation.isPending}>
                    {testMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Identity Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Identity</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Environment</span>
                    <p className="font-medium">{server.environment || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created By</span>
                    <p className="font-medium">{server.createdBy?.username || 'Unknown'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Tags</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {server.tags && server.tags.length > 0 ? (
                        server.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No tags</span>
                      )}
                    </div>
                  </div>
                  {server.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Notes</span>
                      <p className="font-medium text-sm mt-1">{server.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Connection Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Connection</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Platform</span>
                    <p className="font-medium">{server.platformType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Protocol</span>
                    <p className="font-medium">{server.connectionProtocol}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Host</span>
                    <div className="flex items-center gap-2">
                      <p className="font-medium font-mono">{server.host}</p>
                      <button
                        onClick={() => copyToClipboard(server.host, "Host")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Port</span>
                    <p className="font-medium font-mono">{server.port}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Username</span>
                    <p className="font-medium font-mono">{server.username}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Auth Type</span>
                    <p className="font-medium">{server.authType.replace(/_/g, " ")}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Privilege Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Privilege Escalation</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Privilege Mode</span>
                    <p className="font-medium">{server.privilegeMode}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sudo Mode</span>
                    <p className="font-medium">{server.sudoMode}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Host Key Verification */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Host Key Verification</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-muted-foreground text-sm">Strategy</span>
                    <p className="font-medium">{server.hostKeyStrategy.replace(/_/g, " ")}</p>
                  </div>
                  {server.knownHostFingerprints.length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-sm">Known Fingerprints</span>
                      <div className="mt-2 space-y-2">
                        {server.knownHostFingerprints.map((fp, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="text-[10px]">{fp.keyType}</Badge>
                            <code className="flex-1 bg-secondary px-2 py-1 rounded font-mono">
                              {fp.fingerprint}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Metadata */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Metadata</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created</span>
                    <p className="font-medium">{new Date(server.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated</span>
                    <p className="font-medium">{new Date(server.updatedAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Tested</span>
                    <p className="font-medium">
                      {server.lastTestAt ? new Date(server.lastTestAt).toLocaleString() : "Never"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <ServerMetricsTab serverId={serverId} metricsEnabled={server.metricsEnabled || false} />
        </TabsContent>

        {/* Test History Tab */}
        <TabsContent value="test-history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connection Test History</CardTitle>
                  <CardDescription>Last 10 connection tests</CardDescription>
                </div>
                <Button size="sm" onClick={handleTest} disabled={testMutation.isPending}>
                  {testMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Run Test
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : testHistory && testHistory.history.length > 0 ? (
                <div className="space-y-2">
                  {testHistory.history.map((test) => (
                    <Collapsible
                      key={test.id}
                      open={expandedTests.has(test.id)}
                      onOpenChange={() => toggleTestExpand(test.id)}
                    >
                      <div className="border rounded-lg">
                        <CollapsibleTrigger className="w-full p-4 hover:bg-accent/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {expandedTests.has(test.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              {test.success ? (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              ) : (
                                <XCircle className="h-5 w-5 text-destructive" />
                              )}
                              <div className="text-left">
                                <p className="text-sm font-medium">{test.message}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(test.testedAt).toLocaleString()} • {test.latency}ms • by {test.triggeredBy?.username || 'System'}
                                </p>
                              </div>
                            </div>
                            <Badge variant={test.success ? "default" : "destructive"} className="text-xs">
                              {test.success ? "Success" : "Failed"}
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 pt-0 space-y-3 text-sm">
                            {test.detectedOS && (
                              <div>
                                <span className="text-muted-foreground">Detected OS:</span>
                                <span className="ml-2 font-mono">{test.detectedOS}</span>
                              </div>
                            )}
                            {test.detectedUsername && (
                              <div>
                                <span className="text-muted-foreground">Detected Username:</span>
                                <span className="ml-2 font-mono">{test.detectedUsername}</span>
                              </div>
                            )}
                            
                            {/* Test Steps */}
                            <div className="space-y-2">
                              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Test Steps</p>
                              {test.details && (
                                <div className="space-y-1 text-xs">
                                  {Object.entries(test.details).map(([step, result]: [string, any]) => (
                                    <div key={step} className="flex items-center gap-2">
                                      {result.success ? (
                                        <CheckCircle2 className="h-3 w-3 text-success" />
                                      ) : (
                                        <XCircle className="h-3 w-3 text-destructive" />
                                      )}
                                      <span className="capitalize">{step.replace(/([A-Z])/g, " $1").trim()}</span>
                                      {result.time && <span className="text-muted-foreground">({result.time}ms)</span>}
                                      {result.error && <span className="text-destructive">- {result.error}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {test.errors.length > 0 && (
                              <div>
                                <p className="font-semibold text-xs uppercase tracking-wider text-destructive mb-1">Errors</p>
                                <ul className="list-disc list-inside space-y-1 text-xs text-destructive">
                                  {test.errors.map((error, i) => (
                                    <li key={i}>{error}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {test.warnings.length > 0 && (
                              <div>
                                <p className="font-semibold text-xs uppercase tracking-wider text-warning mb-1">Warnings</p>
                                <ul className="list-disc list-inside space-y-1 text-xs text-warning">
                                  {test.warnings.map((warning, i) => (
                                    <li key={i}>{warning}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">No test history</p>
                  <p className="text-xs text-muted-foreground mt-1">Run a connection test to see results here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit">
          <Card>
            <CardHeader>
              <CardTitle>Edit Server</CardTitle>
              <CardDescription>Update server configuration and credentials</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setFormOpen(true)}>
                Open Edit Form
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dependencies Tab */}
        <TabsContent value="dependencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dependencies</CardTitle>
              <CardDescription>Resources that depend on this server</CardDescription>
            </CardHeader>
            <CardContent>
              {depsLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : dependencies ? (
                <div className="space-y-4">
                  {!dependencies.hasDependencies ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                      <p className="text-sm font-medium">No dependencies</p>
                      <p className="text-xs text-muted-foreground mt-1">This server can be safely deleted</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Integrations */}
                      {dependencies.dependencies.integrations && dependencies.dependencies.integrations.count > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-3">
                            Integrations ({dependencies.dependencies.integrations.count})
                          </h4>
                          <div className="space-y-2">
                            {dependencies.dependencies.integrations.items.map((integration: any) => (
                              <div
                                key={integration.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="text-sm font-medium">{integration.name}</p>
                                    <p className="text-xs text-muted-foreground">{integration.provider}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={integration.isActive ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {integration.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                  <Badge
                                    variant={
                                      integration.healthStatus === "HEALTHY"
                                        ? "default"
                                        : integration.healthStatus === "DOWN"
                                        ? "destructive"
                                        : "secondary"
                                    }
                                    className="text-xs"
                                  >
                                    {integration.healthStatus}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Applications (Universal Healer - Discovered Sites/Apps) */}
                      {dependencies.dependencies.applications && dependencies.dependencies.applications.count > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-3">
                            Discovered Applications ({dependencies.dependencies.applications.count})
                          </h4>
                          <div className="space-y-2">
                            {dependencies.dependencies.applications.items.map((app: any) => (
                              <div
                                key={app.id}
                                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="text-sm font-medium font-mono">{app.domain}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {app.techStack} {app.techStackVersion && `v${app.techStackVersion}`} • {app.path}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {app.healthScore !== null && (
                                    <Badge
                                      variant={
                                        app.healthScore >= 80
                                          ? "default"
                                          : app.healthScore >= 60
                                          ? "secondary"
                                          : "destructive"
                                      }
                                      className="text-xs"
                                    >
                                      Score: {app.healthScore}
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={
                                      app.healthStatus === "HEALTHY"
                                        ? "default"
                                        : app.healthStatus === "DEGRADED"
                                        ? "secondary"
                                        : app.healthStatus === "DOWN"
                                        ? "destructive"
                                        : "outline"
                                    }
                                    className="text-xs"
                                  >
                                    {app.healthStatus}
                                  </Badge>
                                  {app.isHealerEnabled && (
                                    <Badge variant="outline" className="text-xs">
                                      Healer Enabled
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Incidents (placeholder for Module 6) */}
                      {dependencies.dependencies.incidents && dependencies.dependencies.incidents.count > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Incidents ({dependencies.dependencies.incidents.count})</h4>
                          <p className="text-xs text-muted-foreground">Active incidents related to this server</p>
                        </div>
                      )}

                      {/* Jobs (placeholder for Module 5) */}
                      {dependencies.dependencies.jobs && dependencies.dependencies.jobs.count > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Jobs ({dependencies.dependencies.jobs.count})</h4>
                          <p className="text-xs text-muted-foreground">Automation jobs targeting this server</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Form Drawer */}
      <ServerFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        serverId={serverId}
      />
    </div>
  )
}

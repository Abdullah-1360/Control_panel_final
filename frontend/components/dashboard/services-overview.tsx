"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Server, Database, AlertCircle, CheckCircle2, XCircle, Clock, MemoryStick, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface Service {
  name: string
  displayName: string
  status: 'running' | 'stopped' | 'failed' | 'unknown'
  enabled: boolean
  uptime?: number
  memoryUsageMB?: number
  restartCount?: number
  activeConnections?: number
  pid?: number
}

interface ServerWithServices {
  serverId: string
  serverName: string
  metrics: {
    services?: Service[]
  } | null
}

interface ServicesOverviewProps {
  servers: ServerWithServices[]
}

function ServiceStatusIcon({ status }: { status: Service['status'] }) {
  switch (status) {
    case 'running':
      return <CheckCircle2 className="h-4 w-4 text-success" />
    case 'stopped':
      return <XCircle className="h-4 w-4 text-muted-foreground" />
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-destructive" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

function ServiceStatusBadge({ status }: { status: Service['status'] }) {
  const config = {
    running: { label: "Running", className: "bg-success/10 text-success border-success/20" },
    stopped: { label: "Stopped", className: "bg-muted text-muted-foreground border-border" },
    failed: { label: "Failed", className: "bg-destructive/10 text-destructive border-destructive/20" },
    unknown: { label: "Unknown", className: "bg-muted text-muted-foreground border-border" },
  }
  const c = config[status]
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", c.className)}>
      {c.label}
    </Badge>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function ServiceIcon({ name }: { name: string }) {
  if (name.includes('mysql') || name.includes('mariadb')) {
    return <Database className="h-4 w-4" />
  }
  if (name.includes('lshttpd') || name.includes('lsws') || name.includes('apache') || name.includes('nginx')) {
    return <Server className="h-4 w-4" />
  }
  return <Activity className="h-4 w-4" />
}

export function ServicesOverview({ servers }: ServicesOverviewProps) {
  // Aggregate all services across servers
  const allServices: Array<Service & { serverName: string; serverId: string }> = []
  
  servers.forEach(server => {
    if (server.metrics?.services) {
      server.metrics.services.forEach(service => {
        allServices.push({
          ...service,
          serverName: server.serverName,
          serverId: server.serverId,
        })
      })
    }
  })

  // Calculate service statistics
  const serviceStats = {
    total: allServices.length,
    running: allServices.filter(s => s.status === 'running').length,
    stopped: allServices.filter(s => s.status === 'stopped').length,
    failed: allServices.filter(s => s.status === 'failed').length,
  }

  // Group services by type
  const servicesByType = allServices.reduce((acc, service) => {
    const type = service.name
    if (!acc[type]) {
      acc[type] = []
    }
    acc[type].push(service)
    return acc
  }, {} as Record<string, typeof allServices>)

  if (allServices.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Services Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No service data available</p>
            <p className="text-xs text-muted-foreground mt-1">
              Collect metrics from servers to see service status
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Services Status</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Monitoring {serviceStats.total} services across {servers.filter(s => s.metrics?.services && s.metrics.services.length > 0).length} servers
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">{serviceStats.running} Running</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="text-xs text-muted-foreground">{serviceStats.stopped} Stopped</span>
            </div>
            {serviceStats.failed > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs text-destructive font-medium">{serviceStats.failed} Failed</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {Object.entries(servicesByType).map(([type, services]) => {
            const runningCount = services.filter(s => s.status === 'running').length
            const totalCount = services.length
            const failedCount = services.filter(s => s.status === 'failed').length
            
            return (
              <div key={type} className="border border-border rounded-lg overflow-hidden">
                {/* Service Type Header */}
                <div className="bg-muted/30 px-4 py-2.5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-md bg-background border border-border flex items-center justify-center">
                        <ServiceIcon name={type} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{services[0].displayName}</h3>
                        <p className="text-xs text-muted-foreground">{totalCount} {totalCount === 1 ? 'instance' : 'instances'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {failedCount > 0 && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                          {failedCount} Failed
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        runningCount === totalCount 
                          ? "bg-success/10 text-success border-success/20" 
                          : "bg-muted text-muted-foreground border-border"
                      )}>
                        {runningCount}/{totalCount} Running
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Service Instances */}
                <div className="divide-y divide-border">
                  {services.map((service, idx) => (
                    <div
                      key={`${service.serverId}-${idx}`}
                      className={cn(
                        "px-4 py-3 hover:bg-accent/30 transition-colors",
                        service.status === 'failed' && "bg-destructive/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Server Name & Status */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <ServiceStatusIcon status={service.status} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{service.serverName}</p>
                            {service.status === 'running' && service.uptime !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                Uptime: {formatUptime(service.uptime)}
                              </p>
                            )}
                            {service.status === 'failed' && (
                              <p className="text-xs text-destructive">Service failed to start</p>
                            )}
                            {service.status === 'stopped' && (
                              <p className="text-xs text-muted-foreground">Service is stopped</p>
                            )}
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="flex items-center gap-4">
                          {service.memoryUsageMB !== undefined && service.memoryUsageMB > 0 && (
                            <div className="flex items-center gap-1.5">
                              <MemoryStick className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-mono text-foreground tabular-nums">
                                {service.memoryUsageMB}MB
                              </span>
                            </div>
                          )}
                          
                          {service.activeConnections !== undefined && service.activeConnections > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-mono text-foreground tabular-nums">
                                {service.activeConnections} conn
                              </span>
                            </div>
                          )}

                          {service.restartCount !== undefined && service.restartCount > 0 && (
                            <div className="flex items-center gap-1.5">
                              <RefreshCw className="h-3.5 w-3.5 text-warning" />
                              <span className="text-xs font-mono text-warning tabular-nums">
                                {service.restartCount} restarts
                              </span>
                            </div>
                          )}

                          {service.pid && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">PID:</span>
                              <span className="text-xs font-mono text-foreground">{service.pid}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

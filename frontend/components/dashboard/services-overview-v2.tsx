"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Server, Database, CheckCircle2, XCircle, Clock, MemoryStick, RefreshCw, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Service {
  name: string
  displayName: string
  status: 'running' | 'stopped' | 'failed' | 'unknown'
  enabled: boolean
  uptime?: number
  memoryUsageMB?: number
  cpuUsagePercent?: number
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

function ServiceStatusBadge({ status }: { status: Service['status'] }) {
  const config = {
    running: { 
      label: "Running", 
      className: "bg-success/10 text-success border-success/30",
      icon: CheckCircle2
    },
    stopped: { 
      label: "Stopped", 
      className: "bg-muted/50 text-muted-foreground border-border",
      icon: XCircle
    },
    failed: { 
      label: "Failed", 
      className: "bg-destructive/10 text-destructive border-destructive/30",
      icon: AlertCircle
    },
    unknown: { 
      label: "Unknown", 
      className: "bg-muted/50 text-muted-foreground border-border",
      icon: Clock
    },
  }
  const c = config[status]
  const Icon = c.icon
  
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs font-medium px-2 py-0.5", c.className)}>
      <Icon className="h-3 w-3" />
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">No service data available</p>
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
            {serviceStats.stopped > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="text-xs text-muted-foreground">{serviceStats.stopped} Stopped</span>
              </div>
            )}
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
        <div className="space-y-6">
          {Object.entries(servicesByType).map(([type, services]) => {
            const runningCount = services.filter(s => s.status === 'running').length
            const totalCount = services.length
            const failedCount = services.filter(s => s.status === 'failed').length
            
            return (
              <div key={type} className="space-y-3">
                {/* Service Type Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-md bg-muted/50 border border-border flex items-center justify-center">
                      <ServiceIcon name={type} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{services[0].displayName}</h3>
                      <p className="text-xs text-muted-foreground">{totalCount} {totalCount === 1 ? 'instance' : 'instances'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {failedCount > 0 && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs font-medium">
                        {failedCount} Failed
                      </Badge>
                    )}
                    <Badge variant="outline" className={cn(
                      "text-xs font-medium",
                      runningCount === totalCount 
                        ? "bg-success/10 text-success border-success/30" 
                        : "bg-muted/50 text-muted-foreground border-border"
                    )}>
                      {runningCount}/{totalCount} Running
                    </Badge>
                  </div>
                </div>

                {/* Service Instances Table */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Server</th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Status</th>
                        <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Uptime</th>
                        <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Memory</th>
                        {services.some(s => s.activeConnections !== undefined && s.activeConnections > 0) && (
                          <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Connections</th>
                        )}
                        {services.some(s => s.restartCount !== undefined && s.restartCount > 0) && (
                          <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">Restarts</th>
                        )}
                        <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">PID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {services.map((service, idx) => (
                        <tr
                          key={`${service.serverId}-${idx}`}
                          className={cn(
                            "hover:bg-accent/30 transition-colors",
                            service.status === 'failed' && "bg-destructive/5"
                          )}
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-foreground">{service.serverName}</span>
                          </td>
                          <td className="px-4 py-3">
                            <ServiceStatusBadge status={service.status} />
                          </td>
                          <td className="px-4 py-3">
                            {service.status === 'running' && service.uptime !== undefined ? (
                              <span className="text-sm text-foreground">{formatUptime(service.uptime)}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {service.memoryUsageMB !== undefined && service.memoryUsageMB > 0 ? (
                              <span className="text-sm font-mono text-foreground tabular-nums">{service.memoryUsageMB} MB</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          {services.some(s => s.activeConnections !== undefined && s.activeConnections > 0) && (
                            <td className="px-4 py-3 text-right">
                              {service.activeConnections !== undefined && service.activeConnections > 0 ? (
                                <span className="text-sm font-mono text-foreground tabular-nums">{service.activeConnections}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </td>
                          )}
                          {services.some(s => s.restartCount !== undefined && s.restartCount > 0) && (
                            <td className="px-4 py-3 text-right">
                              {service.restartCount !== undefined && service.restartCount > 0 ? (
                                <span className="text-sm font-mono text-warning tabular-nums">{service.restartCount}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right">
                            {service.pid ? (
                              <span className="text-sm font-mono text-muted-foreground tabular-nums">{service.pid}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

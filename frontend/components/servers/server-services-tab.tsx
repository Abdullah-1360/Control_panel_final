"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Server, Database, AlertCircle, CheckCircle2, XCircle, Clock, MemoryStick, RefreshCw, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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

interface ServerServicesTabProps {
  services?: Service[]
  isLoading?: boolean
}

function ServiceStatusIcon({ status }: { status: Service['status'] }) {
  switch (status) {
    case 'running':
      return <CheckCircle2 className="h-5 w-5 text-success" />
    case 'stopped':
      return <XCircle className="h-5 w-5 text-muted-foreground" />
    case 'failed':
      return <AlertCircle className="h-5 w-5 text-destructive" />
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />
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
    <Badge variant="outline" className={cn("text-xs font-medium", c.className)}>
      {c.label}
    </Badge>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) return `${days} days, ${hours} hours`
  if (hours > 0) return `${hours} hours, ${minutes} minutes`
  return `${minutes} minutes`
}

function ServiceIcon({ name }: { name: string }) {
  if (name.includes('mysql') || name.includes('mariadb')) {
    return <Database className="h-5 w-5" />
  }
  if (name.includes('lshttpd') || name.includes('lsws') || name.includes('apache') || name.includes('nginx')) {
    return <Server className="h-5 w-5" />
  }
  return <Activity className="h-5 w-5" />
}

export function ServerServicesTab({ services, isLoading }: ServerServicesTabProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading services...</p>
        </div>
      </div>
    )
  }

  if (!services || services.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">No Services Detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              No monitored services found on this server
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const runningServices = services.filter(s => s.status === 'running').length
  const stoppedServices = services.filter(s => s.status === 'stopped').length
  const failedServices = services.filter(s => s.status === 'failed').length

  return (
    <div className="space-y-6">
      {/* Service Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Services</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{services.length}</p>
              </div>
              <Activity className="h-10 w-10 text-muted-foreground opacity-30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-success uppercase tracking-wider">Running</p>
                <p className="text-3xl font-bold tabular-nums mt-1 text-success">{runningServices}</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-success opacity-30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Stopped</p>
                <p className="text-3xl font-bold tabular-nums mt-1">{stoppedServices}</p>
              </div>
              <XCircle className="h-10 w-10 text-muted-foreground opacity-30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-destructive uppercase tracking-wider">Failed</p>
                <p className="text-3xl font-bold tabular-nums mt-1 text-destructive">{failedServices}</p>
              </div>
              <AlertCircle className="h-10 w-10 text-destructive opacity-30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {services.map((service, idx) => (
          <Card key={idx} className={cn(
            "border-border bg-card transition-all",
            service.status === 'failed' && "border-destructive/30 bg-destructive/5"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    service.status === 'running' ? "bg-success/10 text-success" :
                    service.status === 'failed' ? "bg-destructive/10 text-destructive" :
                    "bg-muted text-muted-foreground"
                  )}>
                    <ServiceIcon name={service.name} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">{service.displayName}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{service.name}</p>
                  </div>
                </div>
                <ServiceStatusBadge status={service.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Service Metrics */}
              <div className="grid grid-cols-2 gap-3">
                {service.uptime !== undefined && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Uptime</p>
                      <p className="text-xs font-medium truncate">{formatUptime(service.uptime)}</p>
                    </div>
                  </div>
                )}

                {service.memoryUsageMB !== undefined && service.memoryUsageMB > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <MemoryStick className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Memory</p>
                      <p className="text-xs font-medium tabular-nums">{service.memoryUsageMB} MB</p>
                    </div>
                  </div>
                )}

                {service.restartCount !== undefined && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Restarts</p>
                      <p className="text-xs font-medium tabular-nums">{service.restartCount}</p>
                    </div>
                  </div>
                )}

                {service.activeConnections !== undefined && service.activeConnections > 0 && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                    <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Connections</p>
                      <p className="text-xs font-medium tabular-nums">{service.activeConnections}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Service Info */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Auto-start:</span>
                    <Badge variant={service.enabled ? "default" : "secondary"} className="text-[10px] h-4">
                      {service.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  {service.pid && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">PID:</span>
                      <span className="font-mono font-medium">{service.pid}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

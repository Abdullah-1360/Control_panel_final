"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Search,
  Plus,
  MoreHorizontal,
  Terminal,
  Trash2,
  Filter,
  Grid3X3,
  List,
  Server as ServerIcon,
  RefreshCw,
  Edit,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useServers, useDeleteServer, useTestServerConnection } from "@/hooks/use-servers"
import { useAggregatedMetrics, useCollectMetrics } from "@/hooks/use-metrics"
import type { Server, TestStatus } from "@/lib/types/server"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ServerFormDrawer } from "@/components/servers/server-form-drawer"

interface ServersViewProps {
  onSelectServer: (serverId: string) => void
}

function TestStatusBadge({ status }: { status: TestStatus }) {
  const config: Record<TestStatus, { label: string; className: string; icon: React.ReactNode }> = {
    NEVER_TESTED: {
      label: "Not Tested",
      className: "bg-muted text-muted-foreground border-border",
      icon: <Clock className="h-3 w-3" />,
    },
    OK: {
      label: "Connected",
      className: "bg-success/10 text-success border-success/20",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    FAILED: {
      label: "Failed",
      className: "bg-destructive/10 text-destructive border-destructive/20",
      icon: <XCircle className="h-3 w-3" />,
    },
  }
  const c = config[status]
  return (
    <Badge variant="outline" className={cn("gap-1.5 text-[10px] font-medium", c.className)}>
      {c.icon}
      {c.label}
    </Badge>
  )
}

function MetricsBar({ label, value, icon: Icon, threshold = 90 }: {
  label: string
  value: number
  icon: React.ElementType
  threshold?: number
}) {
  const getColor = () => {
    if (value >= threshold) return "bg-destructive"
    if (value >= threshold - 20) return "bg-warning"
    return "bg-primary"
  }

  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className={cn(
            "text-[10px] font-mono font-medium tabular-nums",
            value >= threshold ? "text-destructive" : value >= threshold - 20 ? "text-warning" : "text-foreground"
          )}>
            {value.toFixed(1)}%
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("h-full rounded-full transition-all", getColor())}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function ServerCard({ server, onSelect, onTest, onDelete, onEdit, onCollectMetrics, metrics }: { 
  server: Server
  onSelect: () => void
  onTest: () => void
  onDelete: () => void
  onEdit: () => void
  onCollectMetrics: () => void
  metrics?: any
}) {
  // Check if any threshold is exceeded
  const hasAlert = metrics && metrics.collectionSuccess && (
    (server.alertCpuThreshold && metrics.cpuUsagePercent >= server.alertCpuThreshold) ||
    (server.alertRamThreshold && metrics.memoryUsagePercent >= server.alertRamThreshold) ||
    (server.alertDiskThreshold && metrics.diskUsagePercent >= server.alertDiskThreshold)
  )

  return (
    <Card
      className="group cursor-pointer border-border bg-card transition-all hover:border-primary/20 hover:bg-accent/30"
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary relative">
              <ServerIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              {hasAlert && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive border-2 border-card animate-pulse" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold font-mono text-foreground">{server.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{server.host}:{server.port}</p>
            </div>
          </div>
          <TestStatusBadge status={server.lastTestStatus} />
        </div>

        <div className="mt-4 space-y-2">
          {metrics && metrics.collectionSuccess ? (
            <>
              <MetricsBar label="CPU" value={metrics.cpuUsagePercent} icon={Cpu} threshold={90} />
              <MetricsBar label="RAM" value={metrics.memoryUsagePercent} icon={Activity} threshold={95} />
              <MetricsBar label="Disk" value={metrics.diskUsagePercent} icon={HardDrive} threshold={90} />
            </>
          ) : metrics && !metrics.collectionSuccess ? (
            <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="text-[10px] text-destructive">Metrics collection failed</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Platform</span>
                <Badge variant="secondary" className="text-[10px] h-5">{server.platformType}</Badge>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Environment</span>
                <span className="font-mono text-foreground">{server.environment || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Auth Type</span>
                <span className="font-mono text-foreground">{server.authType.replace(/_/g, ' ')}</span>
              </div>
              {server.metricsEnabled && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border mt-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground">No metrics collected yet</span>
                </div>
              )}
            </>
          )}
        </div>

        {server.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {server.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] h-5">
                {tag}
              </Badge>
            ))}
            {server.tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] h-5">
                +{server.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-[10px] text-muted-foreground">
            {server.lastTestAt ? `Tested ${new Date(server.lastTestAt).toLocaleDateString()}` : 'Never tested'}
          </span>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onTest}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-xs gap-2" onClick={onEdit}>
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={onTest}>
                  <Terminal className="h-3.5 w-3.5" />
                  Test Connection
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs gap-2" onClick={onCollectMetrics}>
                  <Activity className="h-3.5 w-3.5" />
                  {server.metricsEnabled ? 'Collect Metrics Now' : 'Enable & Collect Metrics'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs text-destructive gap-2" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ServerTableRow({ server, onSelect, onTest, onDelete, onEdit, onCollectMetrics, metrics }: {
  server: Server
  onSelect: () => void
  onTest: () => void
  onDelete: () => void
  onEdit: () => void
  onCollectMetrics: () => void
  metrics?: any
}) {
  // Check if any threshold is exceeded
  const hasAlert = metrics && metrics.collectionSuccess && (
    (server.alertCpuThreshold && metrics.cpuUsagePercent >= server.alertCpuThreshold) ||
    (server.alertRamThreshold && metrics.memoryUsagePercent >= server.alertRamThreshold) ||
    (server.alertDiskThreshold && metrics.diskUsagePercent >= server.alertDiskThreshold)
  )

  return (
    <TableRow
      className="cursor-pointer border-border transition-colors hover:bg-accent/30"
      onClick={onSelect}
    >
      <TableCell>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium font-mono text-foreground">{server.name}</p>
            {hasAlert && (
              <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">{server.host}:{server.port}</p>
        </div>
      </TableCell>
      <TableCell>
        <TestStatusBadge status={server.lastTestStatus} />
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-[10px] h-5">
          {server.platformType}
        </Badge>
      </TableCell>
      {metrics && metrics.collectionSuccess ? (
        <>
          <TableCell>
            <div className="flex items-center gap-2">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all", 
                    metrics.cpuUsagePercent >= 90 ? "bg-destructive" : 
                    metrics.cpuUsagePercent >= 70 ? "bg-warning" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(metrics.cpuUsagePercent, 100)}%` }}
                />
              </div>
              <span className={cn(
                "text-[11px] font-mono font-medium tabular-nums w-10 text-right",
                metrics.cpuUsagePercent >= 90 ? "text-destructive" : 
                metrics.cpuUsagePercent >= 70 ? "text-warning" : "text-foreground"
              )}>
                {metrics.cpuUsagePercent.toFixed(1)}%
              </span>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all",
                    metrics.memoryUsagePercent >= 95 ? "bg-destructive" :
                    metrics.memoryUsagePercent >= 75 ? "bg-warning" : "bg-chart-2"
                  )}
                  style={{ width: `${Math.min(metrics.memoryUsagePercent, 100)}%` }}
                />
              </div>
              <span className={cn(
                "text-[11px] font-mono font-medium tabular-nums w-10 text-right",
                metrics.memoryUsagePercent >= 95 ? "text-destructive" :
                metrics.memoryUsagePercent >= 75 ? "text-warning" : "text-foreground"
              )}>
                {metrics.memoryUsagePercent.toFixed(1)}%
              </span>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all",
                    metrics.diskUsagePercent >= 90 ? "bg-destructive" :
                    metrics.diskUsagePercent >= 70 ? "bg-warning" : "bg-success"
                  )}
                  style={{ width: `${Math.min(metrics.diskUsagePercent, 100)}%` }}
                />
              </div>
              <span className={cn(
                "text-[11px] font-mono font-medium tabular-nums w-10 text-right",
                metrics.diskUsagePercent >= 90 ? "text-destructive" :
                metrics.diskUsagePercent >= 70 ? "text-warning" : "text-foreground"
              )}>
                {metrics.diskUsagePercent.toFixed(1)}%
              </span>
            </div>
          </TableCell>
        </>
      ) : (
        <>
          <TableCell className="text-[11px] text-muted-foreground">-</TableCell>
          <TableCell className="text-[11px] text-muted-foreground">-</TableCell>
          <TableCell className="text-[11px] text-muted-foreground">-</TableCell>
        </>
      )}
      <TableCell className="text-[11px] text-muted-foreground">
        {server.environment || 'N/A'}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {server.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] h-5">
              {tag}
            </Badge>
          ))}
          {server.tags.length > 2 && (
            <Badge variant="outline" className="text-[10px] h-5">
              +{server.tags.length - 2}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-xs gap-2" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2" onClick={onTest}>
              <Terminal className="h-3.5 w-3.5" />
              Test Connection
            </DropdownMenuItem>
            {server.metricsEnabled && (
              <DropdownMenuItem className="text-xs gap-2" onClick={onCollectMetrics}>
                <Activity className="h-3.5 w-3.5" />
                Collect Metrics
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-destructive gap-2" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function ServersView({ onSelectServer }: ServersViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TestStatus | "all">("all")
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const limit = 50
  
  // Form drawer state
  const [formOpen, setFormOpen] = useState(false)
  const [editingServerId, setEditingServerId] = useState<string | undefined>(undefined)

  // Listen for keyboard shortcut to open server form
  useEffect(() => {
    const handleOpenForm = () => {
      handleAddNew()
    }

    window.addEventListener("open-server-form", handleOpenForm)
    return () => window.removeEventListener("open-server-form", handleOpenForm)
  }, [])

  // Fetch servers with polling every 5 seconds
  const { data, isLoading, error } = useServers(
    {
      page,
      limit,
      search: search || undefined,
      lastTestStatus: statusFilter !== "all" ? statusFilter : undefined,
      platformType: platformFilter !== "all" ? (platformFilter as any) : undefined,
    },
    { refetchInterval: 5000 } // Poll every 5 seconds
  )

  // Fetch aggregated metrics with polling every 30 seconds
  const { data: metricsData } = useAggregatedMetrics()

  const deleteMutation = useDeleteServer()
  const testMutation = useTestServerConnection()
  const collectMetricsMutation = useCollectMetrics()

  const handleDelete = (server: Server) => {
    if (confirm(`Are you sure you want to delete "${server.name}"?`)) {
      deleteMutation.mutate({ id: server.id })
    }
  }

  const handleTest = (server: Server) => {
    testMutation.mutate({ id: server.id, async: true })
  }
  
  const handleCollectMetrics = (server: Server) => {
    toast.promise(
      collectMetricsMutation.mutateAsync(server.id),
      {
        loading: `Collecting metrics from ${server.name}...`,
        success: (data) => {
          return `Metrics collected: CPU ${data.cpuUsagePercent}%, RAM ${data.memoryUsagePercent}%, Disk ${data.diskUsagePercent}%`
        },
        error: (err) => `Failed to collect metrics: ${err.message}`,
      }
    )
  }
  
  const handleEdit = (server: Server) => {
    setEditingServerId(server.id)
    setFormOpen(true)
  }
  
  const handleAddNew = () => {
    setEditingServerId(undefined)
    setFormOpen(true)
  }
  
  const handleFormSuccess = () => {
    // Form will stay open with success message per Q10
    // User can click "View Server" or close manually
  }

  const servers = data?.data || []
  const pagination = data?.pagination

  // Create metrics lookup map
  const metricsMap = new Map(
    metricsData?.servers?.map(s => [s.serverId, s.metrics]) || []
  )

  // Calculate status counts - use real total from API
  const statusCounts = {
    all: pagination?.total || 0,
    NEVER_TESTED: servers.filter((s) => s.lastTestStatus === "NEVER_TESTED").length,
    OK: servers.filter((s) => s.lastTestStatus === "OK").length,
    FAILED: servers.filter((s) => s.lastTestStatus === "FAILED").length,
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-sm font-medium text-foreground">Failed to load servers</p>
        <p className="text-xs text-muted-foreground mt-1">{(error as any).message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Status Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(["all", "OK", "FAILED", "NEVER_TESTED"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
              statusFilter === status
                ? "bg-accent text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground border border-transparent",
            )}
          >
            {status !== "all" && (
              <div
                className={cn("h-1.5 w-1.5 rounded-full", {
                  "bg-success": status === "OK",
                  "bg-destructive": status === "FAILED",
                  "bg-muted-foreground": status === "NEVER_TESTED",
                })}
              />
            )}
            <span className="capitalize">{status === "NEVER_TESTED" ? "Not Tested" : status}</span>
            <span className="text-muted-foreground tabular-nums">
              ({status === "all" ? statusCounts.all : statusCounts[status]})
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, host, or tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-secondary/50 pl-9 text-xs border-border"
            />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-9 w-32 bg-secondary/50 text-[11px] border-border">
              <Filter className="mr-1.5 h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="LINUX">Linux</SelectItem>
              <SelectItem value="WINDOWS">Windows</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-none", viewMode === "grid" && "bg-accent")}
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 rounded-none", viewMode === "table" && "bg-accent")}
              onClick={() => setViewMode("table")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={handleAddNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Server
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Grid View */}
      {!isLoading && viewMode === "grid" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {servers.map((server) => (
            <ServerCard
              key={server.id}
              server={server}
              onSelect={() => onSelectServer(server.id)}
              onTest={() => handleTest(server)}
              onDelete={() => handleDelete(server)}
              onEdit={() => handleEdit(server)}
              onCollectMetrics={() => handleCollectMetrics(server)}
              metrics={metricsMap.get(server.id)}
            />
          ))}
        </div>
      )}

      {/* Table View */}
      {!isLoading && viewMode === "table" && (
        <Card className="border-border bg-card overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Server
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Platform
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    CPU
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    RAM
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Disk
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Environment
                  </TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Tags
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server) => (
                  <ServerTableRow
                    key={server.id}
                    server={server}
                    onSelect={() => onSelectServer(server.id)}
                    onTest={() => handleTest(server)}
                    onDelete={() => handleDelete(server)}
                    onEdit={() => handleEdit(server)}
                    onCollectMetrics={() => handleCollectMetrics(server)}
                    metrics={metricsMap.get(server.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && servers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
            <ServerIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">No servers found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search || statusFilter !== "all" || platformFilter !== "all"
              ? "Try adjusting your search or filters"
              : "Get started by adding your first server"}
          </p>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} servers
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      
      {/* Server Form Drawer */}
      <ServerFormDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        serverId={editingServerId}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}

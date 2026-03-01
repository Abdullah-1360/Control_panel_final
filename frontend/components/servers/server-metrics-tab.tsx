"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import {
  Cpu,
  Activity,
  HardDrive,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  TrendingUp,
  Network,
  Zap,
  Server as ServerIcon,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useServerLatestMetrics, useServerMetricsHistory, useCollectMetrics } from "@/hooks/use-metrics"
import { toast } from "sonner"

// Utility function to format large numbers (inodes)
function formatNumber(num: number | string | undefined): string {
  if (num === undefined || num === null) return 'N/A'
  const n = typeof num === 'string' ? parseInt(num, 10) : num
  if (isNaN(n)) return 'N/A'
  if (n >= 1000000000) {
    return `${(n / 1000000000).toFixed(2)}B`
  } else if (n >= 1000000) {
    return `${(n / 1000000).toFixed(2)}M`
  } else if (n >= 1000) {
    return `${(n / 1000).toFixed(2)}K`
  } else {
    return n.toString()
  }
}

// Utility function to format bytes/MB to human-readable format
function formatBytes(mb: number): string {
  if (mb >= 1024 * 1024) {
    // Convert to TB
    return `${(mb / (1024 * 1024)).toFixed(2)} TB`
  } else if (mb >= 1024) {
    // Convert to GB
    return `${(mb / 1024).toFixed(2)} GB`
  } else {
    // Keep as MB
    return `${mb.toFixed(2)} MB`
  }
}

// Utility function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

interface ServerMetricsTabProps {
  serverId: string
  metricsEnabled: boolean
}

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  threshold,
  sparklineData,
  customDisplay,
}: {
  label: string
  value: number | null | undefined
  unit: string
  icon: React.ElementType
  threshold?: number
  sparklineData?: Array<{ value: number }>
  customDisplay?: string
}) {
  const numValue = value ?? 0
  const isWarning = threshold && numValue >= threshold - 20 && numValue < threshold
  const isDanger = threshold && numValue >= threshold

  return (
    <Card className={cn(
      "border-border",
      isDanger && "border-destructive/50 bg-destructive/5",
      isWarning && "border-warning/50 bg-warning/5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn(
                "h-4 w-4",
                isDanger ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground"
              )} />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn(
                "text-2xl font-bold font-mono tabular-nums",
                isDanger ? "text-destructive" : isWarning ? "text-warning" : "text-foreground"
              )}>
                {customDisplay || (value != null ? value.toFixed(1) : 'N/A')}
              </span>
              {!customDisplay && <span className="text-sm text-muted-foreground">{unit}</span>}
            </div>
          </div>
          {sparklineData && sparklineData.length > 0 && (
            <div className="w-20 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={isDanger ? "hsl(var(--destructive))" : isWarning ? "hsl(var(--warning))" : "hsl(var(--primary))"}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={isDanger ? "hsl(var(--destructive))" : isWarning ? "hsl(var(--warning))" : "hsl(var(--primary))"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={isDanger ? "hsl(var(--destructive))" : isWarning ? "hsl(var(--warning))" : "hsl(var(--primary))"}
                    strokeWidth={1.5}
                    fill={`url(#gradient-${label})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MetricChart({
  title,
  data,
  dataKey,
  color,
  unit,
  threshold,
}: {
  title: string
  data: any[]
  dataKey: string
  color: string
  unit: string
  threshold?: number
}) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`${value.toFixed(1)}${unit}`, title]}
            />
            {threshold && (
              <Line
                type="monotone"
                dataKey={() => threshold}
                stroke="hsl(var(--destructive))"
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function ServerMetricsTab({ serverId, metricsEnabled }: ServerMetricsTabProps) {
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [diskBreakdownExpanded, setDiskBreakdownExpanded] = useState(false)

  const { data: latestMetrics, isLoading: latestLoading, refetch: refetchLatest } = useServerLatestMetrics(
    serverId,
    metricsEnabled
  )
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useServerMetricsHistory(
    serverId,
    24
  )
  const collectMutation = useCollectMetrics()

  // Update lastUpdated when metrics data changes
  useEffect(() => {
    if (latestMetrics?.collectedAt) {
      setLastUpdated(new Date(latestMetrics.collectedAt))
    }
  }, [latestMetrics])

  const handleRefresh = async () => {
    if (collectMutation.isPending) return

    toast.promise(
      collectMutation.mutateAsync(serverId),
      {
        loading: "Collecting metrics...",
        success: (data) => {
          setLastUpdated(new Date())
          refetchLatest()
          refetchHistory()
          return `Metrics collected: CPU ${data.cpuUsagePercent}%, RAM ${data.memoryUsagePercent}%, Disk ${data.diskUsagePercent}%`
        },
        error: (err) => `Failed to collect metrics: ${err.message}`,
      }
    )
  }

  const handleManualRefresh = () => {
    setLastUpdated(new Date())
    refetchLatest()
    refetchHistory()
    toast.success("Metrics refreshed")
  }

  // Format history data for charts
  const chartData = historyData?.map((item: any) => ({
    time: new Date(item.collectedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    cpu: item.cpuUsagePercent,
    memory: item.memoryUsagePercent,
    disk: item.diskUsagePercent,
  })) || []

  // Generate sparkline data (last 10 points)
  const sparklineData = chartData.slice(-10).map((item: any) => ({ value: item.cpu }))
  const memorySparklineData = chartData.slice(-10).map((item: any) => ({ value: item.memory }))
  const diskSparklineData = chartData.slice(-10).map((item: any) => ({ value: item.disk }))

  // Calculate time since last update
  const timeSinceUpdate = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000)

  if (!metricsEnabled) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Metrics collection is not enabled for this server. Edit the server configuration to enable metrics.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (latestLoading && historyLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  if (!latestMetrics || !latestMetrics.collectionSuccess) {
    return (
      <div className="p-6">
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium text-foreground mb-2">No metrics available</p>
            <p className="text-xs text-muted-foreground mb-4 text-center">
              {latestMetrics?.errorMessage || "Metrics have not been collected yet for this server"}
            </p>
            <Button onClick={handleRefresh} disabled={collectMutation.isPending}>
              {collectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Collecting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Collect Now
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with refresh controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Server Metrics</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: {timeSinceUpdate < 60 ? `${timeSinceUpdate} seconds ago` : `${Math.floor(timeSinceUpdate / 60)} minutes ago`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleManualRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleRefresh} disabled={collectMutation.isPending}>
            {collectMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Collecting...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 mr-2" />
                Collect Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Primary Metrics - Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="CPU Usage"
          value={latestMetrics.cpuUsagePercent ?? 0}
          unit="%"
          icon={Cpu}
          threshold={90}
          sparklineData={sparklineData}
        />
        <StatCard
          label="Memory Usage"
          value={latestMetrics.memoryUsagePercent ?? 0}
          unit="%"
          icon={Activity}
          threshold={95}
          sparklineData={memorySparklineData}
        />
        <StatCard
          label="Disk Usage"
          value={latestMetrics.diskUsagePercent ?? 0}
          unit="%"
          icon={HardDrive}
          threshold={90}
          sparklineData={diskSparklineData}
        />
        <StatCard
          label="Inode Usage"
          value={latestMetrics.inodeUsagePercent ?? 0}
          unit="%"
          icon={FileText}
          threshold={90}
        />
        <StatCard
          label="Uptime"
          value={0}
          unit=""
          icon={Clock}
          customDisplay={latestMetrics.uptime ? formatUptime(latestMetrics.uptime) : 'N/A'}
        />
      </div>

      {/* Charts - 24h History */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MetricChart
            title="CPU Usage (24h)"
            data={chartData}
            dataKey="cpu"
            color="hsl(var(--primary))"
            unit="%"
            threshold={90}
          />
          <MetricChart
            title="Memory Usage (24h)"
            data={chartData}
            dataKey="memory"
            color="hsl(var(--chart-2))"
            unit="%"
            threshold={95}
          />
          <MetricChart
            title="Disk Usage (24h)"
            data={chartData}
            dataKey="disk"
            color="hsl(var(--success))"
            unit="%"
            threshold={90}
          />
        </div>
      )}

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Load Average</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">1 min</span>
                <span className="font-mono font-medium">{latestMetrics.loadAverage1m?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">5 min</span>
                <span className="font-mono font-medium">{latestMetrics.loadAverage5m?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">15 min</span>
                <span className="font-mono font-medium">{latestMetrics.loadAverage15m?.toFixed(2) || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Inodes</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-medium">
                  {latestMetrics.inodeTotal != null ? formatNumber(latestMetrics.inodeTotal) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Used</span>
                <span className="font-mono font-medium">
                  {latestMetrics.inodeUsed != null ? formatNumber(latestMetrics.inodeUsed) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Free</span>
                <span className="font-mono font-medium">
                  {latestMetrics.inodeFree != null ? formatNumber(latestMetrics.inodeFree) : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Network I/O</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">RX Total</span>
                <span className="font-mono font-medium">
                  {latestMetrics.networkRxTotalMB != null ? formatBytes(latestMetrics.networkRxTotalMB) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">TX Total</span>
                <span className="font-mono font-medium">
                  {latestMetrics.networkTxTotalMB != null ? formatBytes(latestMetrics.networkTxTotalMB) : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Disk I/O</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Read</span>
                <span className="font-mono font-medium">{latestMetrics.diskReadMBps?.toFixed(2) || 'N/A'} MB/s</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Write</span>
                <span className="font-mono font-medium">{latestMetrics.diskWriteMBps?.toFixed(2) || 'N/A'} MB/s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ServerIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Processes</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-medium">{latestMetrics.processCount || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Threads</span>
                <span className="font-mono font-medium">{latestMetrics.threadCount || 'N/A'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Disk & Inode Breakdown Table */}
      {latestMetrics.diskBreakdown && latestMetrics.diskBreakdown.length > 0 && (
        <Card className="border-border">
          <Collapsible open={diskBreakdownExpanded} onOpenChange={setDiskBreakdownExpanded}>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-2">
                  {diskBreakdownExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-sm font-medium">
                    Disk & Inode Breakdown by Filesystem
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {latestMetrics.diskBreakdown.length} filesystems
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <CardDescription className="mt-2">
                Detailed storage and inode usage per mounted filesystem
              </CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Filesystem</TableHead>
                        <TableHead className="w-[150px]">Mount Point</TableHead>
                        <TableHead className="text-right">Disk Total</TableHead>
                        <TableHead className="text-right">Disk Used</TableHead>
                        <TableHead className="text-right">Disk Free</TableHead>
                        <TableHead className="text-right">Disk %</TableHead>
                        <TableHead className="text-right">Inodes Total</TableHead>
                        <TableHead className="text-right">Inodes Used</TableHead>
                        <TableHead className="text-right">Inodes Free</TableHead>
                        <TableHead className="text-right">Inode %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {latestMetrics.diskBreakdown.map((fs, index) => {
                        const diskWarning = fs.diskUsagePercent >= 70 && fs.diskUsagePercent < 90
                        const diskDanger = fs.diskUsagePercent >= 90
                        const inodeWarning = fs.inodeUsagePercent >= 70 && fs.inodeUsagePercent < 90
                        const inodeDanger = fs.inodeUsagePercent >= 90

                        return (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-xs">
                              {fs.filesystem}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {fs.mountPoint}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {fs.diskTotalGB.toFixed(2)} GB
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {fs.diskUsedGB.toFixed(2)} GB
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {fs.diskFreeGB.toFixed(2)} GB
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={diskDanger ? "destructive" : diskWarning ? "secondary" : "outline"}
                                className={cn(
                                  "text-xs font-mono",
                                  diskWarning && "bg-warning/20 text-warning border-warning/50"
                                )}
                              >
                                {fs.diskUsagePercent.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatNumber(fs.inodeTotal)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatNumber(fs.inodeUsed)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatNumber(fs.inodeFree)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={inodeDanger ? "destructive" : inodeWarning ? "secondary" : "outline"}
                                className={cn(
                                  "text-xs font-mono",
                                  inodeWarning && "bg-warning/20 text-warning border-warning/50"
                                )}
                              >
                                {fs.inodeUsagePercent.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}
    </div>
  )
}

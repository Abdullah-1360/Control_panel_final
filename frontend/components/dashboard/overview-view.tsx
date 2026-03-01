"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatCard } from "./stat-card"
import { ServicesOverview } from "./services-overview-v2"
import {
  Server,
  Activity,
  HardDrive,
  Wifi,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Globe,
  TrendingUp,
  Loader2,
  FileText,
  Network,
} from "lucide-react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import { useServers } from "@/hooks/use-servers"
import { useAggregatedMetrics, useAggregatedMetricsHistory } from "@/hooks/use-metrics"
import { useMemo } from "react"

const tooltipStyle = {
  backgroundColor: "hsl(230, 14%, 10%)",
  border: "1px solid hsl(228, 10%, 15%)",
  borderRadius: "8px",
  color: "hsl(210, 20%, 96%)",
  fontSize: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
}

interface OverviewViewProps {
  onViewChange: (view: string) => void
}

export function OverviewView({ onViewChange }: OverviewViewProps) {
  // Fetch real data
  const { data: serversData, isLoading: serversLoading, error: serversError } = useServers(
    { page: 1, limit: 100 },
    { refetchInterval: 30000 }
  )
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useAggregatedMetrics()
  const { data: metricsHistory, isLoading: historyLoading } = useAggregatedMetricsHistory(2) // 2 hours

  const servers = serversData?.data || []
  const totalServers = serversData?.pagination?.total || 0
  const metrics = metricsData || {
    avgCpuUsage: 0,
    avgMemoryUsage: 0,
    avgDiskUsage: 0,
    avgInodeUsage: 0,
    totalServers: 0,
    serversWithMetrics: 0,
    totalStorageGB: 0,
    usedStorageGB: 0,
    totalNetworkRxMB: 0,
    totalNetworkTxMB: 0,
    servers: [],
  }

  // Debug logging
  console.log('Dashboard Data:', {
    serversCount: servers.length,
    totalServers,
    metricsData,
    avgCpu: metrics.avgCpuUsage,
    serversWithMetrics: metrics.serversWithMetrics,
    metricsServers: metrics.servers.length,
    serversError: serversError?.message,
    metricsError: metricsError?.message,
  })

  // Calculate real stats
  const runningServers = servers.filter((s) => s.lastTestStatus === "OK").length
  const totalStorageGB = useMemo(() => {
    return metrics.servers
      .filter((s) => s.metrics?.diskTotalGB)
      .reduce((sum, s) => sum + (s.metrics?.diskTotalGB || 0), 0)
  }, [metrics.servers])

  const usedStorageGB = useMemo(() => {
    return metrics.servers
      .filter((s) => s.metrics?.diskUsedGB)
      .reduce((sum, s) => sum + (s.metrics?.diskUsedGB || 0), 0)
  }, [metrics.servers])

  const storageUsagePercent = totalStorageGB > 0 ? (usedStorageGB / totalStorageGB) * 100 : 0

  // Format storage display (TB if >= 1000 GB, otherwise GB)
  const formatStorage = (gb: number) => {
    if (gb >= 1000) {
      return `${(gb / 1024).toFixed(2)} TB`
    }
    return `${gb.toFixed(1)} GB`
  }

  // Calculate uptime (average across all servers)
  const avgUptimeSeconds = useMemo(() => {
    const serversWithUptime = metrics.servers.filter((s) => s.metrics?.uptime)
    if (serversWithUptime.length === 0) return 0
    return (
      serversWithUptime.reduce((sum, s) => sum + (s.metrics?.uptime || 0), 0) /
      serversWithUptime.length
    )
  }, [metrics.servers])

  const uptimePercent = avgUptimeSeconds > 0 ? 99.9 : 0 // Simplified calculation

  // Calculate average inode usage
  const avgInodeUsage = useMemo(() => {
    const serversWithInodes = metrics.servers.filter((s) => s.metrics?.inodeUsagePercent)
    if (serversWithInodes.length === 0) return 0
    return (
      serversWithInodes.reduce((sum, s) => sum + (s.metrics?.inodeUsagePercent || 0), 0) /
      serversWithInodes.length
    )
  }, [metrics.servers])

  // Top resource consumers (real data)
  const topServers = useMemo(() => {
    return metrics.servers
      .filter((s) => s.metrics?.collectionSuccess)
      .map((s) => ({
        id: s.serverId,
        name: s.serverName,
        cpu: s.metrics?.cpuUsagePercent || 0,
        ram: s.metrics?.memoryUsagePercent || 0,
        disk: s.metrics?.diskUsagePercent || 0,
        inode: s.metrics?.inodeUsagePercent || 0,
        status:
          (s.metrics?.cpuUsagePercent || 0) >= 90 || (s.metrics?.memoryUsagePercent || 0) >= 95
            ? "critical"
            : (s.metrics?.cpuUsagePercent || 0) >= 70 || (s.metrics?.memoryUsagePercent || 0) >= 75
              ? "warning"
              : "running",
      }))
      .sort((a, b) => b.cpu + b.ram - (a.cpu + a.ram))
      .slice(0, 5)
  }, [metrics.servers])

  // Generate CPU history data from real historical metrics
  const cpuData = useMemo(() => {
    if (metricsHistory && metricsHistory.length > 0) {
      // Use real historical data
      return metricsHistory.map((point) => ({
        time: new Date(point.collectedAt).toLocaleTimeString("en-US", { 
          hour: "2-digit", 
          minute: "2-digit", 
          hour12: false 
        }),
        cpu: point.avgCpuUsage,
        memory: point.avgMemoryUsage,
        disk: point.avgDiskUsage,
      }));
    }
    
    // Fallback: If no history yet, show current metrics only
    if (metrics.serversWithMetrics > 0) {
      const now = new Date();
      return [{
        time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        cpu: metrics.avgCpuUsage,
        memory: metrics.avgMemoryUsage,
        disk: metrics.avgDiskUsage,
      }];
    }
    
    return [];
  }, [metricsHistory, metrics.avgCpuUsage, metrics.avgMemoryUsage, metrics.avgDiskUsage, metrics.serversWithMetrics])

  // Calculate total network traffic
  const totalNetworkData = useMemo(() => {
    const serversWithNetwork = metrics.servers.filter((s) => s.metrics?.networkRxTotalMB || s.metrics?.networkTxTotalMB)
    if (serversWithNetwork.length === 0) return { rx: 0, tx: 0 }
    
    const totalRx = serversWithNetwork.reduce((sum, s) => sum + (s.metrics?.networkRxTotalMB || 0), 0)
    const totalTx = serversWithNetwork.reduce((sum, s) => sum + (s.metrics?.networkTxTotalMB || 0), 0)
    
    return { rx: totalRx, tx: totalTx }
  }, [metrics.servers])

  // Server regions (based on environment tags)
  const regionData = useMemo(() => {
    const regions: Record<string, number> = {}
    servers.forEach((server) => {
      const env = server.environment || "Unknown"
      regions[env] = (regions[env] || 0) + 1
    })

    const colors = [
      "hsl(160, 84%, 44%)",
      "hsl(217, 91%, 60%)",
      "hsl(38, 92%, 50%)",
      "hsl(220, 10%, 46%)",
    ]

    return Object.entries(regions)
      .map(([name, count], index) => ({
        name,
        value: totalServers > 0 ? Math.round((count / totalServers) * 100) : 0,
        color: colors[index % colors.length],
      }))
      .slice(0, 4)
  }, [servers, totalServers])

  // Recent activity (from server test status)
  const recentActivity = useMemo(() => {
    const activities = []
    
    // Add activities from servers
    servers.slice(0, 6).forEach((server) => {
      if (server.lastTestStatus === "OK") {
        activities.push({
          icon: CheckCircle2,
          text: `${server.name} health check passed`,
          time: server.lastTestAt
            ? new Date(server.lastTestAt).toLocaleString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12: true,
              })
            : "Recently",
          color: "text-success",
        })
      } else if (server.lastTestStatus === "FAILED") {
        activities.push({
          icon: XCircle,
          text: `${server.name} connection failed`,
          time: server.lastTestAt
            ? new Date(server.lastTestAt).toLocaleString("en-US", {
                hour: "numeric",
                minute: "numeric",
                hour12: true,
              })
            : "Recently",
          color: "text-destructive",
        })
      }
    })

    // Add metrics alerts
    topServers.forEach((server) => {
      if (server.status === "critical") {
        activities.push({
          icon: AlertTriangle,
          text: `${server.name} high resource usage (CPU: ${server.cpu}%, RAM: ${server.ram}%)`,
          time: "Just now",
          color: "text-warning",
        })
      }
    })

    return activities.slice(0, 5)
  }, [servers, topServers])

  const isLoading = serversLoading || metricsLoading || historyLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      {/* Status Banner */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-2 w-2">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </div>
          <span className="text-xs text-muted-foreground">
            All systems operational.{" "}
            <span className="font-medium text-foreground">
              {runningServers} of {totalServers} servers running
            </span>
          </span>
        </div>
        <span className="hidden text-[10px] text-muted-foreground sm:block">
          Last updated: just now
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Servers"
          value={totalServers.toString()}
          change={`${metrics.serversWithMetrics} with metrics`}
          changeType="neutral"
          icon={Server}
        />
        <StatCard
          label="Avg. CPU Usage"
          value={`${metrics.avgCpuUsage.toFixed(1)}%`}
          change={metrics.avgCpuUsage > 70 ? "High usage" : "Normal"}
          changeType={metrics.avgCpuUsage > 70 ? "negative" : "positive"}
          icon={Activity}
          subtitle="across all servers"
        />
        <StatCard
          label="Avg. Memory"
          value={`${metrics.avgMemoryUsage.toFixed(1)}%`}
          change={metrics.avgMemoryUsage > 75 ? "High usage" : "Normal"}
          changeType={metrics.avgMemoryUsage > 75 ? "negative" : "positive"}
          icon={Activity}
          subtitle="across all servers"
        />
        <StatCard
          label="Total Storage"
          value={formatStorage(totalStorageGB)}
          change={`${storageUsagePercent.toFixed(0)}% used`}
          changeType={storageUsagePercent > 80 ? "negative" : "neutral"}
          icon={HardDrive}
        />
        <StatCard
          label="Avg. Inodes"
          value={`${avgInodeUsage.toFixed(1)}%`}
          change={avgInodeUsage > 70 ? "High usage" : "Normal"}
          changeType={avgInodeUsage > 70 ? "negative" : "positive"}
          icon={FileText}
          subtitle="file system nodes"
        />
      </div>

      {/* Charts Row - Modern Design */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Multi-Metric Chart */}
        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-foreground">Resource Usage Overview</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">CPU, Memory & Disk usage - Last 2 hours (5-min intervals)</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground">CPU</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-chart-2" />
                <span className="text-[10px] text-muted-foreground">Memory</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-[10px] text-muted-foreground">Disk</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {cpuData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cpuData}>
                    <defs>
                      <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="diskGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.3} />
                    <XAxis
                      dataKey="time"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      domain={[0, 100]}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      }}
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}%`,
                        name === 'cpu' ? 'CPU' : name === 'memory' ? 'Memory' : 'Disk'
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="cpu"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#cpuGradient)"
                      animationDuration={1000}
                    />
                    <Area
                      type="monotone"
                      dataKey="memory"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      fill="url(#memoryGradient)"
                      animationDuration={1000}
                    />
                    <Area
                      type="monotone"
                      dataKey="disk"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      fill="url(#diskGradient)"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                No metrics data available. Collect metrics to see charts.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Network Traffic Card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground">Network Traffic</CardTitle>
              <Network className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Total data transferred</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-chart-2" />
                    <span className="text-xs text-muted-foreground">Received</span>
                  </div>
                  <span className="text-sm font-mono font-semibold text-foreground">
                    {totalNetworkData.rx >= 1024 
                      ? `${(totalNetworkData.rx / 1024).toFixed(2)} GB`
                      : `${totalNetworkData.rx.toFixed(2)} MB`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-chart-2 transition-all duration-500"
                    style={{ width: `${Math.min((totalNetworkData.rx / (totalNetworkData.rx + totalNetworkData.tx)) * 100, 100)}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground">Transmitted</span>
                  </div>
                  <span className="text-sm font-mono font-semibold text-foreground">
                    {totalNetworkData.tx >= 1024 
                      ? `${(totalNetworkData.tx / 1024).toFixed(2)} GB`
                      : `${totalNetworkData.tx.toFixed(2)} MB`}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min((totalNetworkData.tx / (totalNetworkData.rx + totalNetworkData.tx)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total Traffic</span>
                  <span className="text-lg font-mono font-bold text-foreground">
                    {(totalNetworkData.rx + totalNetworkData.tx) >= 1024 
                      ? `${((totalNetworkData.rx + totalNetworkData.tx) / 1024).toFixed(2)} GB`
                      : `${(totalNetworkData.rx + totalNetworkData.tx).toFixed(2)} MB`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Servers</div>
                  <div className="text-xl font-bold text-foreground">{metrics.serversWithMetrics}</div>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Active</div>
                  <div className="text-xl font-bold text-success">{runningServers}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Redesigned */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Server Environments - Redesigned */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground">Server Environments</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">{totalServers} servers across {regionData.length} environments</p>
              </div>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {regionData.length > 0 ? (
              <div className="space-y-2">
                {regionData.map((region, index) => {
                  const serverCount = Math.round((region.value / 100) * totalServers)
                  const runningInEnv = servers.filter(s => (s.environment || "Unknown") === region.name && s.lastTestStatus === "OK").length
                  
                  return (
                    <div 
                      key={region.name} 
                      className="group relative overflow-hidden rounded-lg border border-border bg-gradient-to-r from-secondary/40 to-secondary/20 p-3 transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
                      onClick={() => onViewChange("servers")}
                    >
                      {/* Background gradient bar */}
                      <div 
                        className="absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20"
                        style={{ 
                          background: `linear-gradient(to right, ${region.color} 0%, transparent 100%)`,
                          width: `${region.value}%`
                        }}
                      />
                      
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div 
                            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                            style={{ backgroundColor: `${region.color}20`, border: `1px solid ${region.color}40` }}
                          >
                            <Globe className="h-5 w-5" style={{ color: region.color }} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-foreground truncate">
                                {region.name || "Unknown"}
                              </span>
                              <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
                                <span className="text-[10px] text-success font-medium">{runningInEnv} online</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <Server className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{serverCount} {serverCount === 1 ? 'server' : 'servers'}</span>
                              </div>
                              <div className="h-3 w-px bg-border" />
                              <span className="text-xs font-mono font-bold tabular-nums" style={{ color: region.color }}>
                                {region.value}%
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Globe className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">No environment data</p>
                <p className="text-xs text-muted-foreground mt-1">Add servers to see distribution</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity - Redesigned */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-foreground">Recent Activity</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">Latest events from {recentActivity.length} sources</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => onViewChange("servers")}
              >
                View All <ArrowUpRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((event, i) => {
                  const isSuccess = event.color === 'text-success'
                  const isError = event.color === 'text-destructive'
                  const isWarning = event.color === 'text-warning'
                  
                  return (
                    <div 
                      key={i} 
                      className={`group relative overflow-hidden rounded-lg border p-3 transition-all hover:shadow-md cursor-pointer ${
                        isSuccess ? 'border-success/30 bg-success/5 hover:border-success/50' :
                        isError ? 'border-destructive/30 bg-destructive/5 hover:border-destructive/50' :
                        'border-warning/30 bg-warning/5 hover:border-warning/50'
                      }`}
                      onClick={() => onViewChange("servers")}
                    >
                      {/* Animated pulse for critical events */}
                      {isError && (
                        <div className="absolute inset-0 bg-destructive/5 animate-pulse" />
                      )}
                      
                      <div className="relative flex items-start gap-3">
                        <div className={`mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                          isSuccess ? 'bg-success/20 border border-success/30' :
                          isError ? 'bg-destructive/20 border border-destructive/30' :
                          'bg-warning/20 border border-warning/30'
                        }`}>
                          <event.icon className={`h-4 w-4 ${event.color}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-relaxed text-foreground mb-1.5 line-clamp-2">
                            {event.text}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground/60" />
                              <span className="text-[10px] text-muted-foreground/80 font-medium">{event.time}</span>
                            </div>
                            {isError && (
                              <>
                                <div className="h-3 w-px bg-border" />
                                <span className="text-[10px] text-destructive font-semibold uppercase tracking-wider">Action Required</span>
                              </>
                            )}
                            {isSuccess && (
                              <>
                                <div className="h-3 w-px bg-border" />
                                <span className="text-[10px] text-success font-medium">Healthy</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">Events will appear here as they occur</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Resource Consumers - Redesigned with Table Layout */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-foreground">Top Resource Consumers</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {topServers.length} servers with highest resource usage
                {topServers.filter(s => s.status === 'critical').length > 0 && (
                  <span className="ml-2 text-destructive font-semibold">
                    • {topServers.filter(s => s.status === 'critical').length} critical
                  </span>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[11px] bg-transparent border-border hover:bg-accent"
              onClick={() => onViewChange("servers")}
            >
              View All Servers <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {topServers.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-8">#</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Server</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-32">CPU</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-32">Memory</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-32">Disk</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 w-32">Inode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topServers.map((server, index) => (
                    <tr
                      key={server.id}
                      className={`group transition-colors hover:bg-accent/30 cursor-pointer ${
                        server.status === 'critical' ? 'bg-destructive/5' : ''
                      }`}
                      onClick={() => onViewChange("servers")}
                    >
                      {/* Rank */}
                      <td className="px-4 py-3">
                        <div className={`h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                          index === 0 ? 'bg-warning/20 text-warning border border-warning/30' :
                          index === 1 ? 'bg-muted text-muted-foreground border border-border' :
                          index === 2 ? 'bg-chart-3/20 text-chart-3 border border-chart-3/30' :
                          'bg-secondary text-secondary-foreground border border-border'
                        }`}>
                          {index + 1}
                        </div>
                      </td>

                      {/* Server Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              server.status === "running"
                                ? "bg-success animate-pulse-dot"
                                : server.status === "warning"
                                  ? "bg-warning"
                                  : "bg-destructive animate-pulse-dot"
                            }`}
                          />
                          <span className="text-sm font-mono font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {server.name}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3">
                        {server.status === 'critical' ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/30">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            <span className="text-xs font-semibold text-destructive uppercase tracking-wider">Critical</span>
                          </div>
                        ) : server.status === 'warning' ? (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning/10 border border-warning/30">
                            <AlertTriangle className="h-3 w-3 text-warning" />
                            <span className="text-xs font-semibold text-warning uppercase tracking-wider">Warning</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-success/10 border border-success/30">
                            <CheckCircle2 className="h-3 w-3 text-success" />
                            <span className="text-xs font-semibold text-success uppercase tracking-wider">Healthy</span>
                          </div>
                        )}
                      </td>

                      {/* CPU */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary/80">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                server.cpu > 90 ? "bg-destructive" : 
                                server.cpu > 70 ? "bg-warning" : 
                                "bg-primary"
                              }`}
                              style={{ width: `${Math.min(server.cpu, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-mono font-bold tabular-nums min-w-[3rem] text-right ${
                              server.cpu > 90 ? "text-destructive" :
                              server.cpu > 70 ? "text-warning" :
                              "text-foreground"
                            }`}
                          >
                            {server.cpu.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Memory */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary/80">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                server.ram > 90 ? "bg-destructive" : 
                                server.ram > 70 ? "bg-warning" : 
                                "bg-chart-2"
                              }`}
                              style={{ width: `${Math.min(server.ram, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-mono font-bold tabular-nums min-w-[3rem] text-right ${
                              server.ram > 90 ? "text-destructive" :
                              server.ram > 70 ? "text-warning" :
                              "text-foreground"
                            }`}
                          >
                            {server.ram.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Disk */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2.5">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary/80">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                server.disk > 90 ? "bg-destructive" : 
                                server.disk > 70 ? "bg-warning" : 
                                "bg-success"
                              }`}
                              style={{ width: `${Math.min(server.disk, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-mono font-bold tabular-nums min-w-[3rem] text-right ${
                              server.disk > 90 ? "text-destructive" :
                              server.disk > 70 ? "text-warning" :
                              "text-foreground"
                            }`}
                          >
                            {server.disk.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Inode */}
                      <td className="px-4 py-3">
                        {server.inode > 0 ? (
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary/80">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  server.inode > 90 ? "bg-destructive" : 
                                  server.inode > 70 ? "bg-warning" : 
                                  "bg-chart-3"
                                }`}
                                style={{ width: `${Math.min(server.inode, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-mono font-bold tabular-nums min-w-[3rem] text-right ${
                                server.inode > 90 ? "text-destructive" :
                                server.inode > 70 ? "text-warning" :
                                "text-foreground"
                              }`}
                            >
                              {server.inode.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end">
                            <span className="text-xs text-muted-foreground min-w-[3rem] text-right">-</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-border bg-secondary/20">
              <Server className="h-16 w-16 mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">No metrics data available</p>
              <p className="text-xs text-muted-foreground mt-1">Collect metrics from servers to see top consumers</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services Overview */}
      <ServicesOverview servers={metrics.servers} />
    </div>
  )
}

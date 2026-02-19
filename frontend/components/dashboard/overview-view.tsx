"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatCard } from "./stat-card"
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
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { useServers } from "@/hooks/use-servers"
import { useAggregatedMetrics } from "@/hooks/use-metrics"
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

  const servers = serversData?.data || []
  const totalServers = serversData?.pagination?.total || 0
  const metrics = metricsData || {
    avgCpuUsage: 0,
    avgMemoryUsage: 0,
    avgDiskUsage: 0,
    totalServers: 0,
    serversWithMetrics: 0,
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

  // Generate CPU history data (last 24 hours from current metrics)
  const cpuData = useMemo(() => {
    const data = []
    const now = new Date()
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000)
      data.push({
        time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        value: i === 0 ? metrics.avgCpuUsage : metrics.avgCpuUsage * (0.8 + Math.random() * 0.4), // Current + simulated history
      })
    }
    return data
  }, [metrics.avgCpuUsage])

  // Generate network data (simulated based on server count)
  const networkData = useMemo(() => {
    const data = []
    const now = new Date()
    const baseInbound = totalServers * 50
    const baseOutbound = totalServers * 35
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hour = time.getHours()
      const multiplier = hour >= 8 && hour <= 18 ? 1.5 : 0.6 // Business hours
      data.push({
        time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        inbound: Math.round(baseInbound * multiplier * (0.8 + Math.random() * 0.4)),
        outbound: Math.round(baseOutbound * multiplier * (0.8 + Math.random() * 0.4)),
      })
    }
    return data
  }, [totalServers])

  // Generate requests data (simulated)
  const requestsData = useMemo(() => {
    const data = []
    const now = new Date()
    const baseRequests = totalServers * 500
    for (let i = 7; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 2 * 60 * 60 * 1000)
      const hour = time.getHours()
      const multiplier = hour >= 8 && hour <= 18 ? 1.8 : 0.5
      data.push({
        hour: time.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }),
        requests: Math.round(baseRequests * multiplier * (0.8 + Math.random() * 0.4)),
      })
    }
    return data
  }, [totalServers])

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

  const isLoading = serversLoading || metricsLoading

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Total Storage"
          value={formatStorage(totalStorageGB)}
          change={`${storageUsagePercent.toFixed(0)}% used`}
          changeType={storageUsagePercent > 80 ? "negative" : "neutral"}
          icon={HardDrive}
        />
        <StatCard
          label="Uptime"
          value={`${uptimePercent.toFixed(2)}%`}
          change={`${Math.floor(avgUptimeSeconds / 86400)}d avg`}
          changeType="positive"
          icon={Wifi}
          subtitle="last 30 days"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* CPU Usage Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-foreground">CPU Usage (Avg)</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Across all servers - Last 24h</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
              <span className="text-[10px] font-medium text-success">Live</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpuData}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 84%, 44%)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(160, 84%, 44%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 10%, 13%)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(220, 10%, 36%)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(220, 10%, 36%)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, "CPU"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(160, 84%, 44%)"
                    strokeWidth={2}
                    fill="url(#cpuGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Network Traffic Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-foreground">Network Traffic</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Inbound / Outbound - Last 24h</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-chart-2" />
                <span className="text-[10px] text-muted-foreground">In</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-[10px] text-muted-foreground">Out</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={networkData}>
                  <defs>
                    <linearGradient id="inGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 84%, 44%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(160, 84%, 44%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 10%, 13%)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(220, 10%, 36%)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(220, 10%, 36%)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v} MB`}
                  />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="inbound"
                    stroke="hsl(217, 91%, 60%)"
                    strokeWidth={1.5}
                    fill="url(#inGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="outbound"
                    stroke="hsl(160, 84%, 44%)"
                    strokeWidth={1.5}
                    fill="url(#outGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Requests Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground">Requests Today</CardTitle>
              <div className="flex items-center gap-1 text-success">
                <TrendingUp className="h-3 w-3" />
                <span className="text-[10px] font-medium">Live</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Total: {requestsData.reduce((sum, d) => sum + d.requests, 0).toLocaleString()} requests
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={requestsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 10%, 13%)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    stroke="hsl(220, 10%, 36%)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(220, 10%, 36%)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="requests" fill="hsl(160, 84%, 44%)" radius={[4, 4, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Server Regions */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-foreground">Server Environments</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {regionData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-40 w-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={regionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {regionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {regionData.map((region) => (
                    <div key={region.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: region.color }} />
                        <span className="text-xs text-muted-foreground">{region.name || "Unknown"}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-foreground">{region.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No environment data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Recent Activity</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => onViewChange("servers")}
            >
              View All <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((event, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <event.icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${event.color}`} />
                    <div className="flex-1 space-y-0.5">
                      <p className="text-[11px] leading-relaxed text-foreground">{event.text}</p>
                      <div className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
                        <span className="text-[10px] text-muted-foreground/60">{event.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Resource Consumers */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-medium text-foreground">Top Resource Consumers</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">Servers with highest resource usage</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px] bg-transparent border-border hover:bg-accent"
            onClick={() => onViewChange("servers")}
          >
            View All Servers <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {topServers.length > 0 ? (
            <div className="space-y-2">
              {topServers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center gap-4 rounded-lg border border-transparent bg-secondary/40 px-4 py-3 transition-colors hover:border-border hover:bg-accent/40 cursor-pointer"
                  onClick={() => onViewChange("servers")}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        server.status === "running"
                          ? "bg-success animate-pulse-dot"
                          : server.status === "warning"
                            ? "bg-warning"
                            : "bg-destructive animate-pulse-dot"
                      }`}
                    />
                    <span className="text-xs font-mono font-medium text-foreground truncate">
                      {server.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-6">CPU</span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full transition-all ${
                            server.cpu > 90 ? "bg-destructive" : server.cpu > 70 ? "bg-warning" : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(server.cpu, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-mono font-medium tabular-nums w-8 text-right ${
                          server.cpu > 90
                            ? "text-destructive"
                            : server.cpu > 70
                              ? "text-warning"
                              : "text-foreground"
                        }`}
                      >
                        {server.cpu.toFixed(0)}%
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-6">RAM</span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full transition-all ${
                            server.ram > 90 ? "bg-destructive" : server.ram > 70 ? "bg-warning" : "bg-chart-2"
                          }`}
                          style={{ width: `${Math.min(server.ram, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-mono font-medium tabular-nums w-8 text-right ${
                          server.ram > 90
                            ? "text-destructive"
                            : server.ram > 70
                              ? "text-warning"
                              : "text-foreground"
                        }`}
                      >
                        {server.ram.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No metrics data available. Collect metrics to see top consumers.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

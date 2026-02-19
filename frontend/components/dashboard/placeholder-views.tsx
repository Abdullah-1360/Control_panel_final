"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Globe,
  Database,
  Shield,
  Activity,
  Users,
  CreditCard,
  Settings,
  Plus,
  ArrowUpRight,
  Lock,
  Unlock,
  Eye,
  Zap,
  BarChart3,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ---- NETWORK ---- */
export function NetworkView() {
  const networks = [
    { name: "vpc-production", cidr: "10.0.0.0/16", servers: 8, region: "US East", status: "active" },
    { name: "vpc-staging", cidr: "10.1.0.0/16", servers: 3, region: "US West", status: "active" },
    { name: "vpc-database", cidr: "10.2.0.0/16", servers: 4, region: "EU West", status: "active" },
  ]

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Virtual Private Clouds</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Manage your network infrastructure</p>
        </div>
        <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create VPC
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total VPCs", value: "3", icon: Globe },
          { label: "Attached Servers", value: "15", icon: Zap },
          { label: "Regions", value: "3", icon: BarChart3 },
        ].map((stat) => (
          <Card key={stat.label} className="border-border bg-card">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-2/10">
                <stat.icon className="h-4 w-4 text-chart-2" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {networks.map((vpc) => (
          <Card
            key={vpc.name}
            className="border-border bg-card transition-all hover:border-chart-2/20 hover:bg-accent/30 cursor-pointer group"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-2/10 group-hover:bg-chart-2/15 transition-colors">
                    <Globe className="h-4 w-4 text-chart-2" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold font-mono text-foreground">{vpc.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{vpc.cidr}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
                  Active
                </Badge>
              </div>
              <Separator className="my-3 bg-border/60" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{vpc.servers} servers attached</span>
                <span>{vpc.region}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ---- DATABASES ---- */
export function DatabasesView() {
  const databases = [
    { name: "prod-postgresql", type: "PostgreSQL 15", size: "128 GB", status: "running", connections: 42, cpu: 34 },
    { name: "prod-redis", type: "Redis 7.2", size: "16 GB", status: "running", connections: 156, cpu: 18 },
    { name: "staging-postgresql", type: "PostgreSQL 15", size: "32 GB", status: "running", connections: 8, cpu: 12 },
  ]

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Managed Databases</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Database clusters and instances</p>
        </div>
        <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Create Database
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {databases.map((db) => (
          <Card
            key={db.name}
            className="border-border bg-card transition-all hover:border-primary/20 hover:bg-accent/30 cursor-pointer group"
          >
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10 shrink-0">
                    <Database className="h-5 w-5 text-chart-2" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold font-mono text-foreground truncate">{db.name}</p>
                      <Badge
                        variant="outline"
                        className="gap-1 bg-success/10 text-success border-success/20 text-[10px] shrink-0"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
                        Running
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{db.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 sm:gap-8">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Size</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{db.size}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Conns</p>
                    <p className="text-xs font-medium tabular-nums text-foreground mt-0.5">{db.connections}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CPU</p>
                    <p className="text-xs font-medium tabular-nums text-foreground mt-0.5">{db.cpu}%</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ---- MONITORING ---- */
export function MonitoringView() {
  const alerts = [
    { severity: "critical", message: "web-prod-03 CPU usage exceeded 95%", time: "5 min ago", server: "web-prod-03" },
    { severity: "warning", message: "db-master-01 disk usage at 82%", time: "15 min ago", server: "db-master-01" },
    { severity: "info", message: "All servers passed health check", time: "30 min ago", server: "All" },
    { severity: "info", message: "Backup completed for prod-postgresql", time: "1 hr ago", server: "prod-postgresql" },
    { severity: "warning", message: "High memory usage on cache-node-01", time: "2 hrs ago", server: "cache-node-01" },
  ]

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Monitoring & Alerts</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Real-time system health and alert management</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 text-xs bg-transparent border-border">
          <Bell className="mr-1.5 h-3.5 w-3.5" />
          Configure Alerts
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall Uptime</p>
            <p className="mt-1 text-3xl font-bold text-success tabular-nums">99.97%</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Response Time</p>
            <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">142ms</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Across all endpoints</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active Alerts</p>
            <p className="mt-1 text-3xl font-bold text-warning tabular-nums">2</p>
            <p className="mt-1 text-[11px] text-muted-foreground">1 critical, 1 warning</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Recent Alerts</CardTitle>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {alerts.length} total
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-transparent bg-secondary/30 p-3 transition-colors hover:border-border hover:bg-accent/30"
              >
                <div
                  className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", {
                    "bg-destructive animate-pulse-dot": alert.severity === "critical",
                    "bg-warning": alert.severity === "warning",
                    "bg-chart-2": alert.severity === "info",
                  })}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">{alert.time}</span>
                    <span className="text-[10px] text-muted-foreground/40">|</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{alert.server}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] capitalize shrink-0", {
                    "bg-destructive/10 text-destructive border-destructive/20": alert.severity === "critical",
                    "bg-warning/10 text-warning border-warning/20": alert.severity === "warning",
                    "bg-chart-2/10 text-chart-2 border-chart-2/20": alert.severity === "info",
                  })}
                >
                  {alert.severity}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---- FIREWALL ---- */
export function FirewallView() {
  const rules = [
    { port: "22", protocol: "TCP", source: "10.0.0.0/8", action: "Allow", label: "SSH Internal" },
    { port: "80", protocol: "TCP", source: "0.0.0.0/0", action: "Allow", label: "HTTP Public" },
    { port: "443", protocol: "TCP", source: "0.0.0.0/0", action: "Allow", label: "HTTPS Public" },
    { port: "5432", protocol: "TCP", source: "10.0.0.0/8", action: "Allow", label: "PostgreSQL" },
    { port: "6379", protocol: "TCP", source: "10.0.0.0/8", action: "Allow", label: "Redis" },
    { port: "*", protocol: "*", source: "0.0.0.0/0", action: "Deny", label: "Default Deny" },
  ]

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Firewall Rules</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Manage inbound and outbound traffic rules</p>
        </div>
        <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Rule
        </Button>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/30"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    rule.action === "Allow" ? "bg-success/10" : "bg-destructive/10",
                  )}
                >
                  {rule.action === "Allow" ? (
                    <Unlock className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-destructive" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">{rule.label}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Port {rule.port} / {rule.protocol} from {rule.source}
                  </p>
                </div>
                <Badge
                  variant={rule.action === "Allow" ? "secondary" : "destructive"}
                  className="text-[10px]"
                >
                  {rule.action}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---- TEAM ---- */
export function TeamView() {
  const members = [
    { name: "John Doe", email: "john@clouddeck.io", role: "Owner", avatar: "JD", lastActive: "Now" },
    { name: "Sarah Chen", email: "sarah@clouddeck.io", role: "Admin", avatar: "SC", lastActive: "2h ago" },
    { name: "Mike Ross", email: "mike@clouddeck.io", role: "Developer", avatar: "MR", lastActive: "5h ago" },
    { name: "Ana Silva", email: "ana@clouddeck.io", role: "Viewer", avatar: "AS", lastActive: "1d ago" },
  ]

  const roleColors: Record<string, string> = {
    Owner: "bg-primary/10 text-primary border-primary/20",
    Admin: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    Developer: "bg-warning/10 text-warning border-warning/20",
    Viewer: "bg-secondary text-muted-foreground border-border",
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Team Members</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Manage access and permissions</p>
        </div>
        <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Invite Member
        </Button>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.email}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/30"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                  {member.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{member.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
                </div>
                <span className="hidden sm:block text-[10px] text-muted-foreground">{member.lastActive}</span>
                <Badge variant="outline" className={cn("text-[10px]", roleColors[member.role])}>
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---- BILLING ---- */
export function BillingView() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Billing & Usage</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Manage your subscription and view usage</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Plan</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-bold text-foreground">Pro</p>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                Active
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">$489/month</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Period</p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">$412.50</p>
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">84% of plan used</span>
                <span className="text-[10px] font-medium tabular-nums text-foreground">$412.50 / $489</span>
              </div>
              <Progress value={84} className="h-1" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next Invoice</p>
            <p className="mt-1 text-2xl font-bold text-foreground">Mar 1</p>
            <p className="text-[11px] text-muted-foreground mt-1">Auto-renewal enabled</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Resource Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-border">
            {[
              { label: "VPS Instances (7)", amount: "$168.00" },
              { label: "Dedicated Servers (1)", amount: "$89.00" },
              { label: "Bare Metal (2)", amount: "$398.00" },
              { label: "Managed Databases (3)", amount: "$156.00" },
              { label: "Bandwidth Overage", amount: "$12.50" },
              { label: "Backups", amount: "$24.00" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-3">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="text-[11px] font-medium tabular-nums text-foreground">{item.amount}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3">
              <span className="text-xs font-semibold text-foreground">Total</span>
              <span className="text-xs font-bold tabular-nums text-foreground">$847.50</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---- SETTINGS ---- */
export function SettingsView() {
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Settings</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Manage your account and organization preferences</p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[
          {
            title: "Organization",
            description: "Manage org name, logo, and default settings",
            icon: Settings,
            color: "bg-muted-foreground/10",
          },
          {
            title: "API Keys",
            description: "Manage API keys for programmatic access",
            icon: Shield,
            color: "bg-primary/10",
          },
          {
            title: "Notifications",
            description: "Configure alert channels and preferences",
            icon: Activity,
            color: "bg-warning/10",
          },
          {
            title: "Audit Log",
            description: "View all team activity and changes",
            icon: Eye,
            color: "bg-chart-2/10",
          },
        ].map((item) => (
          <Card
            key={item.title}
            className="cursor-pointer border-border bg-card transition-all hover:border-primary/20 hover:bg-accent/30 group"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg transition-colors", item.color)}>
                <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

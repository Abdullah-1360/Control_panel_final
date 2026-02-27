"use client"

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Server,
  Activity,
  Shield,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
  Database,
  Users,
  ChevronDown,
  Zap,
  BookOpen,
  FileText,
  Lock,
  Bell,
  Plug,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/lib/auth/store"
import { useServers } from "@/hooks/use-servers"

export type View =
  | "overview"
  | "servers"
  | "server-detail"
  | "network"
  | "databases"
  | "firewall"
  | "monitoring"
  | "integrations"
  | "healer"
  | "users"
  | "audit"
  | "sessions"
  | "notifications"
  | "billing"
  | "settings"

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  collapsed: boolean
  onToggle: () => void
}

export function DashboardSidebar({ currentView, onViewChange, collapsed, onToggle }: SidebarProps) {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role?.name === 'SUPER_ADMIN'
  
  // Fetch server count with real-time polling
  const { data: serversData } = useServers({ page: 1, limit: 1 }, { refetchInterval: 30000 })
  const serverCount = serversData?.pagination?.total || 0

  const mainNav = [
    { id: "overview" as View, label: "Overview", icon: LayoutDashboard },
    { id: "servers" as View, label: "Servers", icon: Server, badge: serverCount.toString() },
    { id: "network" as View, label: "Network", icon: Globe },
    { id: "databases" as View, label: "Databases", icon: Database },
    { id: "monitoring" as View, label: "Monitoring", icon: Activity, dot: true },
    { id: "firewall" as View, label: "Firewall", icon: Shield },
    { id: "integrations" as View, label: "Integrations", icon: Plug },
    { id: "healer" as View, label: "Universal Healer", icon: Wrench },
  ]

  const secondaryNav = [
    { id: "users" as View, label: "Users", icon: Users },
    { id: "audit" as View, label: "Audit Logs", icon: FileText },
    { id: "sessions" as View, label: "Sessions", icon: Lock },
    { id: "notifications" as View, label: "Notifications", icon: Bell, superAdminOnly: true },
    { id: "billing" as View, label: "Billing", icon: CreditCard },
    { id: "settings" as View, label: "Settings", icon: Settings },
  ]
  
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300",
          collapsed ? "w-[60px]" : "w-[240px]"
        )}
      >
        {/* Org Selector */}
        <div className="flex h-14 items-center border-b border-border px-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent",
                  collapsed && "justify-center px-0"
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 text-left">
                      <p className="text-xs font-semibold text-foreground leading-none">CloudDeck</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Pro Plan</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Organizations
              </DropdownMenuLabel>
              <DropdownMenuItem className="gap-2.5 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15">
                  <Zap className="h-3 w-3 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium">CloudDeck</p>
                  <p className="text-[10px] text-muted-foreground">Pro Plan</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-chart-2/15">
                  <Server className="h-3 w-3 text-chart-2" />
                </div>
                <div>
                  <p className="text-xs font-medium">Acme Corp</p>
                  <p className="text-[10px] text-muted-foreground">Enterprise</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs gap-2">
                <Plus className="h-3 w-3" />
                Create Organization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className={cn("mb-2 px-2", collapsed && "hidden")}>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Infrastructure
            </span>
          </div>
          <div className="space-y-0.5">
            {mainNav.map((item) => {
              const isActive =
                currentView === item.id || (item.id === "servers" && currentView === "server-detail")
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewChange(item.id)}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                        isActive
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {item.badge && (
                            <Badge
                              variant="secondary"
                              className="h-5 min-w-[20px] justify-center px-1.5 text-[10px] font-medium tabular-nums"
                            >
                              {item.badge}
                            </Badge>
                          )}
                          {item.dot && (
                            <div className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse-dot" />
                          )}
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="font-medium text-xs">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              )
            })}
          </div>

          <Separator className="my-3 bg-border/60" />

          <div className={cn("mb-2 px-2", collapsed && "hidden")}>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Account
            </span>
          </div>
          <div className="space-y-0.5">
            {secondaryNav
              .filter((item) => !item.superAdminOnly || isSuperAdmin)
              .map((item) => {
              const isActive = currentView === item.id
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewChange(item.id)}
                      className={cn(
                        "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                        isActive
                          ? "bg-accent text-primary"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                      {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                    </button>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="font-medium text-xs">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              )
            })}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-border">
          {/* Docs link */}
          {!collapsed && (
            <div className="px-3 pt-3">
              <button className="flex w-full items-center gap-2.5 rounded-lg bg-accent/50 px-3 py-2.5 transition-colors hover:bg-accent">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <p className="text-xs font-medium text-foreground">Documentation</p>
                  <p className="text-[10px] text-muted-foreground">Guides & API reference</p>
                </div>
              </button>
            </div>
          )}

          {/* Collapse Toggle */}
          <div className="p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggle}
                  className="w-full justify-center text-muted-foreground hover:text-foreground h-8"
                >
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  {!collapsed && <span className="ml-2 text-[11px]">Collapse</span>}
                </Button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  Expand sidebar
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

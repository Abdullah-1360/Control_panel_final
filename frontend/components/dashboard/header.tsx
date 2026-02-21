"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Search, Menu, Command, LogOut, User, Key, Settings as SettingsIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuthStore } from "@/lib/auth/store"
import type { View } from "./sidebar"

interface HeaderProps {
  currentView: View
  sidebarCollapsed: boolean
  onMobileMenuToggle: () => void
}

const viewTitles: Record<View, string> = {
  overview: "Dashboard",
  servers: "Servers",
  "server-detail": "Server Details",
  network: "Network",
  databases: "Databases",
  firewall: "Firewall",
  monitoring: "Monitoring",
  integrations: "Integrations",
  healer: "WordPress Auto-Healer",
  team: "Team",
  billing: "Billing",
  settings: "Settings",
  users: "Users",
  audit: "Audit Logs",
  sessions: "Sessions",
  notifications: "Notifications",
}

const viewSubtitles: Record<View, string> = {
  overview: "Infrastructure overview and metrics",
  servers: "Manage your server fleet",
  "server-detail": "Server configuration and monitoring",
  network: "Virtual private clouds and networking",
  databases: "Managed database instances",
  firewall: "Security rules and access control",
  monitoring: "Alerts and system health",
  integrations: "External service connections",
  healer: "Monitor and fix WordPress site issues",
  team: "Team members and permissions",
  billing: "Usage and invoicing",
  settings: "Account and organization settings",
  users: "User management and roles",
  audit: "Security and activity logs",
  sessions: "Active user sessions",
  notifications: "Notification rules and email history",
}

const notifications = [
  {
    id: 1,
    type: "critical" as const,
    title: "High CPU Alert",
    message: "web-prod-03 CPU at 95% for 5 min",
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    type: "warning" as const,
    title: "Disk Warning",
    message: "db-master-01 disk usage at 82%",
    time: "15 min ago",
    read: false,
  },
  {
    id: 3,
    type: "success" as const,
    title: "Backup Complete",
    message: "Daily backup for all servers completed",
    time: "1 hour ago",
    read: true,
  },
]

export function DashboardHeader({ currentView, sidebarCollapsed, onMobileMenuToggle }: HeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [commandOpen, setCommandOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const getInitials = () => {
    if (!user) return "U"
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    }
    return user.username.substring(0, 2).toUpperCase()
  }

  const getDisplayName = () => {
    if (!user) return "User"
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`
    }
    return user.username
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden h-8 w-8"
          onClick={onMobileMenuToggle}
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-foreground">{viewTitles[currentView]}</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
            {viewSubtitles[currentView]}
          </p>
        </div>
        <h1 className="text-sm font-semibold text-foreground sm:hidden">{viewTitles[currentView]}</h1>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Command Palette Trigger */}
          <button
            onClick={() => setCommandOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search servers, IPs...</span>
            <kbd className="ml-4 flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* Mobile search */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="absolute right-1 top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                </span>
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold text-foreground">Notifications</span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  {notifications.filter((n) => !n.read).length} new
                </Badge>
              </div>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        notification.type === "critical"
                          ? "bg-destructive"
                          : notification.type === "warning"
                            ? "bg-warning"
                            : "bg-success"
                      }`}
                    />
                    <span className="text-xs font-medium text-foreground flex-1">{notification.title}</span>
                    {!notification.read && (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground pl-4">{notification.message}</span>
                  <span className="text-[10px] text-muted-foreground/60 pl-4">{notification.time}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center text-xs text-primary cursor-pointer">
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <UserMenu 
            user={user}
            initials={getInitials()}
            displayName={getDisplayName()}
            onLogout={handleLogout}
          />
        </div>
      </header>

      {/* Command Palette Dialog */}
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 bg-card border-border">
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Search servers, IPs, commands..."
              autoFocus
            />
            <kbd className="flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>
          <div className="p-2 max-h-72 overflow-y-auto">
            <div className="px-2 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Quick Actions
              </span>
            </div>
            {[
              { label: "Deploy New Server", shortcut: "D" },
              { label: "View Monitoring Alerts", shortcut: "M" },
              { label: "Open Console", shortcut: "C" },
              { label: "Manage Firewall Rules", shortcut: "F" },
            ].map((item) => (
              <button
                key={item.label}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setCommandOpen(false)}
              >
                <span>{item.label}</span>
                <kbd className="flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
                  {item.shortcut}
                </kbd>
              </button>
            ))}
            <div className="px-2 py-1.5 mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Recent Servers
              </span>
            </div>
            {[
              { name: "web-prod-01", ip: "45.33.32.156", status: "running" },
              { name: "api-gateway-01", ip: "159.89.214.32", status: "running" },
              { name: "db-master-01", ip: "178.62.198.44", status: "warning" },
            ].map((server) => (
              <button
                key={server.name}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setCommandOpen(false)}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    server.status === "running" ? "bg-success" : "bg-warning"
                  }`}
                />
                <span className="font-mono font-medium text-foreground">{server.name}</span>
                <span className="font-mono text-muted-foreground">{server.ip}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}


interface UserMenuProps {
  user: {
    email: string
    username: string
    role: {
      displayName: string
    }
  } | null
  initials: string
  displayName: string
  onLogout: () => void
}

function UserMenu({ user, initials, displayName, onLogout }: UserMenuProps) {
  const router = useRouter()

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2 h-8">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-xs font-medium text-foreground md:inline-block">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-xs font-medium">{displayName}</span>
            <span className="text-[11px] text-muted-foreground font-normal">{user.email}</span>
            <span className="text-[10px] text-muted-foreground/70 font-normal mt-0.5">
              {user.role?.displayName || user.role?.name || 'User'}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="text-xs cursor-pointer"
          onClick={() => router.push("/settings/profile")}
        >
          <User className="mr-2 h-3.5 w-3.5" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="text-xs cursor-pointer"
          onClick={() => router.push("/settings/security")}
        >
          <Key className="mr-2 h-3.5 w-3.5" />
          Security & MFA
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="text-xs cursor-pointer"
          onClick={() => router.push("/settings")}
        >
          <SettingsIcon className="mr-2 h-3.5 w-3.5" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="text-xs text-destructive cursor-pointer"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

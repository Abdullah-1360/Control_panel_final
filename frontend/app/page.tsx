"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ProtectedRoute } from "@/lib/auth/protected-route"
import { DashboardSidebar, type View } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { OverviewView } from "@/components/dashboard/overview-view"
import { ServersView } from "@/components/dashboard/servers-view"
import { ServerDetailView } from "@/components/dashboard/server-detail-view"
import {
  NetworkView,
  DatabasesView,
  MonitoringView,
  FirewallView,
  BillingView,
} from "@/components/dashboard/placeholder-views"
import SettingsPage from '@/app/(dashboard)/settings/page'
import NotificationsPage from '@/app/(dashboard)/notifications/page'
import { UsersView } from "@/components/dashboard/users-view"
import { AuditLogsView } from "@/components/dashboard/audit-logs-view"
import { SessionsView } from "@/components/dashboard/sessions-view"
import IntegrationsPage from '@/app/(dashboard)/integrations/page'
import { HealerView } from '@/components/healer/HealerView'
import { UniversalHealerView } from '@/components/healer/UniversalHealerView'

export default function Page() {
  const [currentView, setCurrentView] = useState<View>("overview")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)

  const handleViewChange = useCallback((view: View) => {
    setCurrentView(view)
    setSelectedServerId(null)
    setMobileMenuOpen(false)
  }, [])

  const handleSelectServer = useCallback((serverId: string) => {
    setSelectedServerId(serverId)
    setCurrentView("server-detail")
  }, [])

  const handleBackFromDetail = useCallback(() => {
    setCurrentView("servers")
    setSelectedServerId(null)
  }, [])

  const renderView = () => {
    switch (currentView) {
      case "overview":
        return <OverviewView onViewChange={(view) => handleViewChange(view as View)} />
      case "servers":
        return <ServersView onSelectServer={handleSelectServer} />
      case "server-detail":
        return selectedServerId ? (
          <ServerDetailView serverId={selectedServerId} onBack={handleBackFromDetail} />
        ) : (
          <ServersView onSelectServer={handleSelectServer} />
        )
      case "network":
        return <NetworkView />
      case "databases":
        return <DatabasesView />
      case "monitoring":
        return <MonitoringView />
      case "firewall":
        return <FirewallView />
      case "integrations":
        return <IntegrationsPage />
      case "healer":
        return <UniversalHealerView />
      case "users":
        return <UsersView />
      case "audit":
        return <AuditLogsView />
      case "sessions":
        return <SessionsView />
      case "notifications":
        return <NotificationsPage />
      case "billing":
        return <BillingView />
      case "settings":
        return <SettingsPage />
      default:
        return <OverviewView onViewChange={(view) => handleViewChange(view as View)} />
    }
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileMenuOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar - desktop */}
      <div className="hidden lg:block">
        <DashboardSidebar
          currentView={currentView}
          onViewChange={handleViewChange}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Sidebar - mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          "transition-transform duration-300"
        )}
      >
        <DashboardSidebar
          currentView={currentView}
          onViewChange={handleViewChange}
          collapsed={false}
          onToggle={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-60"
        )}
      >
        <DashboardHeader
          currentView={currentView}
          sidebarCollapsed={sidebarCollapsed}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <div className="min-h-[calc(100vh-3.5rem)]">
          {renderView()}
        </div>
      </main>
    </div>
    </ProtectedRoute>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { ServerDetailTabs } from "@/components/servers/server-detail-tabs"

interface ServerDetailViewProps {
  serverId: string
  onBack: () => void
}

export function ServerDetailView({ serverId, onBack }: ServerDetailViewProps) {
  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 px-6 pt-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">Server Details</h2>
      </div>

      {/* Server Detail Tabs */}
      <ServerDetailTabs serverId={serverId} />
    </div>
  )
}

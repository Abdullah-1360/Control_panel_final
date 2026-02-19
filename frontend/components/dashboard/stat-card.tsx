"use client"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Type as type, LucideIcon } from "lucide-react"

interface StatCardProps {
  label: string
  value: string
  change: string
  changeType: "positive" | "negative" | "neutral"
  icon: LucideIcon
  subtitle?: string
  iconColor?: string
}

export function StatCard({
  label,
  value,
  change,
  changeType,
  icon: Icon,
  subtitle,
  iconColor,
}: StatCardProps) {
  return (
    <Card className="border-border bg-card hover:bg-accent/30 transition-colors group">
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            <div className="flex items-center gap-1.5">
              {changeType === "positive" && <TrendingUp className="h-3 w-3 text-success" />}
              {changeType === "negative" && <TrendingDown className="h-3 w-3 text-destructive" />}
              <span
                className={cn(
                  "text-[11px] font-medium",
                  changeType === "positive" && "text-success",
                  changeType === "negative" && "text-destructive",
                  changeType === "neutral" && "text-muted-foreground",
                )}
              >
                {change}
              </span>
              {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
            </div>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              iconColor || "bg-primary/10 group-hover:bg-primary/15",
            )}
          >
            <Icon className={cn("h-5 w-5", iconColor ? "text-foreground" : "text-primary")} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

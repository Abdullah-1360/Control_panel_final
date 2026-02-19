"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Server,
  Users,
  Shield,
  Settings,
  FileText,
  Bell,
  Activity,
  Database,
  Network,
  Search,
  Package,
} from "lucide-react"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  // Toggle command palette with Ctrl+K or Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/"))}
          >
            <Activity className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/?view=servers"))}
          >
            <Server className="mr-2 h-4 w-4" />
            <span>Servers</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/assets"))}
          >
            <Package className="mr-2 h-4 w-4" />
            <span>Assets</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/?view=network"))}
          >
            <Network className="mr-2 h-4 w-4" />
            <span>Network</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/?view=databases"))}
          >
            <Database className="mr-2 h-4 w-4" />
            <span>Databases</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => runCommand(() => router.push("/?view=users"))}
          >
            <Users className="mr-2 h-4 w-4" />
            <span>Users</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/?view=audit-logs"))}
          >
            <FileText className="mr-2 h-4 w-4" />
            <span>Audit Logs</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/?view=sessions"))}
          >
            <Shield className="mr-2 h-4 w-4" />
            <span>Sessions</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/?view=notifications"))}
          >
            <Bell className="mr-2 h-4 w-4" />
            <span>Notifications</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/?view=settings"))}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() => runCommand(() => {
              // Trigger add server action
              const event = new CustomEvent("open-server-form")
              window.dispatchEvent(event)
            })}
          >
            <Server className="mr-2 h-4 w-4" />
            <span>Add New Server</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>N
            </kbd>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => {
              // Trigger search
              const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
              if (searchInput) {
                searchInput.focus()
              }
            })}
          >
            <Search className="mr-2 h-4 w-4" />
            <span>Search Servers</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>F
            </kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

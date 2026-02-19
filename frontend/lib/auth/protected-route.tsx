"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuthStore } from "./store"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check auth on mount
    const verifyAuth = async () => {
      await checkAuth()
      setIsChecking(false)
    }
    
    verifyAuth()
  }, [checkAuth])

  useEffect(() => {
    // Redirect to login if not authenticated after check completes
    if (!isChecking && !isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isChecking, isAuthenticated, isLoading, router])

  // Show loading while checking auth
  if (isChecking || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  // Don't render children until authenticated
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}

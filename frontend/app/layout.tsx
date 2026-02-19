"use client"

import React from "react"
import { Inter, JetBrains_Mono } from "next/font/google"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AuthProvider } from "@/lib/auth/auth-provider"
import { SSEProvider } from "@/components/sse-provider"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { ErrorBoundary } from "@/components/error-boundary"
import { CommandPalette } from "@/components/command-palette"

import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" })

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2000, // Data is fresh for 2 seconds
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <CommandPalette />
              {children}
              <Toaster />
              <SonnerToaster position="top-right" />
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}

'use client'

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { LoginScreen } from "@/components/app/login"
import { AppShell } from "@/components/app/app-shell"

export default function Home() {
  const { data: session, status } = useSession()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // hydration guard for session/theme — intentional setState in effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, [])

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading MSIH CRM…</p>
        </div>
      </div>
    )
  }

  if (!session) return <LoginScreen />

  return <AppShell />
}

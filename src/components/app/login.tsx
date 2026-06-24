"use client";

// MSIH CRM V1.0 — Login Screen
// Developer: Manoj Dore

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Microscope, ShieldCheck, Loader2, LogIn, Eye, EyeOff, Building2, Cpu, BarChart3 } from "lucide-react";

const DEMO = [
  { email: "superadmin@mettechnik.com", label: "Super Admin", name: "Manoj Dore" },
  { email: "admin@mettechnik.com", label: "Admin", name: "Anil Deshpande" },
  { email: "manager@mettechnik.com", label: "Sales Manager", name: "Rohit Sharma" },
  { email: "rohit@mettechnik.com", label: "Sales Executive", name: "Rohit Verma" },
];

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid credentials. Please check your email and password.");
      return;
    }
    router.refresh();
  }

  function quickLogin(em: string) {
    setEmail(em);
    setPassword("admin@123");
    setError("");
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Industrial backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-slate-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            color: "#0EA5E9",
          }}
        />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        {/* Left — brand panel */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 p-10 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-500/20 p-2.5 ring-1 ring-sky-400/30">
              <Microscope className="h-7 w-7 text-sky-300" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">MetTechnik</p>
              <p className="text-xs text-sky-300/80">Sales Intelligence Hub</p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-3xl font-bold leading-tight">
              The operating system for your <span className="text-sky-400">entire sales process.</span>
            </h1>
            <p className="mt-4 text-sm text-slate-300">
              Manage enquiries, follow-ups, quotations, and customer interactions from one
              centralized platform — with AI-driven recommendations and forecasting.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                { icon: Building2, t: "Enquiry Pipeline", d: "Capture leads in &lt; 2 min" },
                { icon: Cpu, t: "AI Sales Assistant", d: "Lead scoring & insights" },
                { icon: BarChart3, t: "Forecasting", d: "Revenue & demand" },
                { icon: ShieldCheck, t: "Role-Based Access", d: "Full audit trail" },
              ].map((f) => (
                <div key={f.t} className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                  <f.icon className="h-5 w-5 text-sky-300" />
                  <p className="mt-2 text-sm font-semibold">{f.t}</p>
                  <p className="text-xs text-slate-400" dangerouslySetInnerHTML={{ __html: f.d }} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>© {new Date().getFullYear()} MetTechnik Pvt. Ltd.</span>
            <span>CRM V1.0 · Developed by Manoj Dore · MIT License</span>
          </div>
        </div>

        {/* Right — login form */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto mb-3 w-fit rounded-xl bg-primary/10 p-3 text-primary ring-1 ring-primary/20">
                <Microscope className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-bold">MSIH CRM</h1>
              <p className="text-sm text-muted-foreground">MetTechnik Sales Intelligence Hub</p>
            </div>

            <Card className="p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to access your sales dashboard.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@mettechnik.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={() => setShow((s) => !s)} className="text-xs text-muted-foreground hover:text-foreground">
                      {show ? <EyeOff className="inline h-3.5 w-3.5" /> : <Eye className="inline h-3.5 w-3.5" />} {show ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading} size="lg">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Sign In
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Quick demo login</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DEMO.map((d) => (
                    <button
                      key={d.email}
                      type="button"
                      onClick={() => quickLogin(d.email)}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-left text-xs transition hover:border-primary/40 hover:bg-accent"
                    >
                      <p className="font-semibold text-foreground">{d.label}</p>
                      <p className="truncate text-muted-foreground">{d.name}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Demo password: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">admin@123</code>
                </p>
              </div>
            </Card>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              MSIH CRM V1.0 · Free & Open Source (MIT) · © MetTechnik Pvt. Ltd.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

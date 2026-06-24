// MSIH CRM V1.0 — Frontend API client helpers

export async function api<T = any>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    credentials: "include",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "Request failed");
    let msg = txt;
    try {
      msg = JSON.parse(txt).error || txt;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const fmtINR = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
};

export const fmtNum = (n: number | null | undefined) => {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN").format(n);
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const timeAgo = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
};

export const statusColor = (status: string) => {
  const map: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    QUALIFIED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    HOT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    WARM: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    COLD: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    LOST: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    CONVERTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    SENT: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    EXPIRED: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    DONE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  };
  return map[status] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
};

export const roleColor = (role: string) => {
  const map: Record<string, string> = {
    SUPER_ADMIN: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    MANAGER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    EXECUTIVE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
  return map[role] || "bg-slate-100 text-slate-600";
};

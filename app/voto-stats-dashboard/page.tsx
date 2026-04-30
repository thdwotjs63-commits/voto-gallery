"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type StatsResponse = {
  summary: {
    today: number;
    yesterday: number;
    totalUnique: number;
  };
  recent7Days: Array<{ date: string; uniqueVisitors: number }>;
  error?: string;
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const auth = searchParams.get("auth") ?? "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!auth) {
        if (mounted) {
          setError("Missing auth query string.");
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/visitors/stats?auth=${encodeURIComponent(auth)}`,
          { cache: "no-store" }
        );
        const payload = (await res.json()) as StatsResponse;
        if (!res.ok) {
          throw new Error(payload.error ?? `Request failed (${res.status})`);
        }
        if (mounted) setData(payload);
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "Failed to load stats");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [auth]);

  const rows = useMemo(() => data?.recent7Days ?? [], [data]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">VOTO Stats Dashboard</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Private route: /voto-stats-dashboard
      </p>

      {loading ? (
        <div className="mt-8 flex items-center gap-3 text-sm text-zinc-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
          Loading visitor data...
        </div>
      ) : error ? (
        <p className="mt-8 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : data ? (
        <div className="mt-8 space-y-6">
          <section className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">오늘 순수 방문자</p>
              <p className="mt-1 text-2xl font-semibold">{data.summary.today}</p>
            </article>
            <article className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">어제 순수 방문자</p>
              <p className="mt-1 text-2xl font-semibold">
                {data.summary.yesterday}
              </p>
            </article>
            <article className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">누적 전체 순수 방문자</p>
              <p className="mt-1 text-2xl font-semibold">
                {data.summary.totalUnique}
              </p>
            </article>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-medium text-zinc-800">최근 7일 방문 흐름</h2>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="py-2 font-medium">날짜</th>
                  <th className="py-2 font-medium">순수 방문자</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date} className="border-b border-zinc-100">
                    <td className="py-2">{row.date}</td>
                    <td className="py-2 font-medium">{row.uniqueVisitors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function DashboardFallback() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">VOTO Stats Dashboard</h1>
      <div className="mt-8 flex items-center gap-3 text-sm text-zinc-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
        Loading visitor data...
      </div>
    </main>
  );
}

export default function VotoStatsDashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}


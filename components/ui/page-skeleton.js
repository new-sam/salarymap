import { Skeleton } from './skeleton';

export function KanbanSkeleton() {
  return (
    <main className="px-6 py-4 pb-8 flex flex-col gap-3 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-1 pb-2 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card px-3 py-2 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
      {/* Kanban */}
      <div className="grid grid-cols-4 gap-3 items-stretch min-h-[60vh]">
        {Array.from({ length: 4 }).map((_, c) => (
          <div key={c} className="rounded-lg border border-[#EEF0F3] bg-[#F7F8FA] p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 pb-2 border-b border-[#E5E8EC]">
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-4 ml-auto" />
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 + (c % 3) }).map((_, j) => (
                <div key={j} className="rounded-md border border-[#E5E8EC] bg-white p-2.5 space-y-1.5">
                  <Skeleton className="h-3 w-16 rounded-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="flex flex-col gap-3" style={{ padding: '20px 28px 40px' }}>
      <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-border p-3 space-y-2">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-border px-4 py-3 flex items-center gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-7 w-14 rounded-md" />
          </div>
        ))}
      </div>
    </main>
  );
}

export function CandidateDetailSkeleton({ mode = 'overlay' }) {
  return (
    <div className={mode === 'overlay' ? 'flex flex-col h-full bg-white' : 'min-h-screen bg-gray-50 px-6 py-6 max-w-[1400px] mx-auto'}>
      <div className="px-6 pt-5 pb-4 border-b border-border space-y-2">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 p-6">
        <Skeleton className="h-[480px] rounded-2xl" />
        <aside className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-3/4 rounded-lg" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

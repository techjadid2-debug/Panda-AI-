export default function Loading() {
  return <main className="flex min-h-screen items-center justify-center p-6">
    <div className="flex items-center gap-3 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
      <span className="text-sm font-medium">Yuklanmoqda…</span>
    </div>
  </main>;
}

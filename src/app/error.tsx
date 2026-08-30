"use client";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="flex min-h-screen items-center justify-center p-6">
    <div className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-7 text-center shadow-sm">
      <h2 className="text-xl font-bold">Kutilmagan xatolik yuz berdi</h2>
      <p className="mt-2 text-sm text-slate-600">Qayta urinib ko‘ring. Muammo takrorlansa, administratorga xabar bering.</p>
      <button onClick={() => retry()} className="mt-5 rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white">Qayta urinish</button>
    </div>
  </main>;
}

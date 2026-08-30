import Link from "next/link";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center p-6">
    <div className="text-center">
      <h2 className="text-xl font-bold">Sahifa topilmadi</h2>
      <p className="mt-2 text-sm text-slate-600">Bunday manzil mavjud emas yoki ko‘chirilgan.</p>
      <Link href="/" className="mt-5 inline-block rounded-xl border border-emerald-200 bg-white px-5 py-2.5 font-semibold text-emerald-800">Bosh sahifaga qaytish</Link>
    </div>
  </main>;
}

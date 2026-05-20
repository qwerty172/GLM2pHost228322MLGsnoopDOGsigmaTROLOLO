import { SiteNav } from "@/components/site-nav";

export default function ProfilePage() {
  return (
    <div
      className="min-h-screen flex flex-col text-slate-300"
      style={{ background: "#06090e" }}
    >
      <SiteNav activePath="/profile" />
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8">
        <h1 className="text-2xl font-bold text-white">Профиль</h1>
        <p className="mt-2 text-slate-500 text-sm">Страница в разработке.</p>
      </main>
    </div>
  );
}

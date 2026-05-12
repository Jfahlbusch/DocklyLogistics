export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="font-display text-4xl text-navy-900">DocklyLogistics</h1>
        <p className="text-stone-500">Logistik- und Rohstoffverwaltung</p>
        <button className="px-4 py-2 rounded-lg bg-navy-900 text-white hover:bg-navy-700 transition-colors text-sm font-medium">
          Los geht&apos;s
        </button>
      </div>
    </main>
  );
}

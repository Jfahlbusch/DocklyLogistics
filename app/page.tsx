import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="space-y-4 text-center">
        <h1 className="font-display text-4xl text-navy-900">DocklyLogistics</h1>
        <p className="text-stone-500">Logistik- und Rohstoffverwaltung</p>
        <Button className="bg-navy-900 hover:bg-navy-700 text-white">Los geht&apos;s</Button>
      </div>
    </main>
  );
}

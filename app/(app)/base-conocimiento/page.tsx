import { listKnowledgeEntries } from "@/lib/db/repos/knowledgeBase";

export default function BaseConocimientoPage() {
  const entries = listKnowledgeEntries();
  const categories = Array.from(new Set(entries.map((e) => e.category)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fly-gold">Base de conocimiento</h1>
        <p className="text-sm text-fly-lightgray/70">
          Documentos internos de referencia rapida de Fly Electric Solutions. No sustituyen al NEC oficial, TDLR,
          Houston Permitting Center ni al diseñador del plano.
        </p>
      </div>

      {categories.map((category) => (
        <section key={category} className="space-y-2">
          <h2 className="font-semibold text-fly-white">{category}</h2>
          <div className="space-y-2">
            {entries
              .filter((e) => e.category === category)
              .map((entry) => (
                <div key={entry.id} className="rounded-xl border border-fly-gray bg-fly-charcoal p-4">
                  <p className="font-medium text-sm">{entry.title}</p>
                  <p className="text-sm text-fly-lightgray/70 mt-1">{entry.body}</p>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

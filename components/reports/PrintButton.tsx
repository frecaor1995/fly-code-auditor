"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-fly-gold text-fly-black font-bold px-5 py-3"
    >
      Imprimir / Guardar como PDF
    </button>
  );
}

// Tipo compartido por las 3 baterias de evaluacion del motor de conocimiento
// (Sprint 0-3). Cada caso es la definicion de ENTRADA de la prueba: id,
// bateria, idioma, texto exacto y la entrada de electricalKnowledgeBase.ts
// que deberia responderla (null para preguntas de control que
// deliberadamente no deben tener respuesta tecnica, o para gaps de
// contenido/recuperacion ya documentados y aceptados como pendientes).
//
// Los campos "entrada obtenida", "score", "util" y "falso positivo" NO se
// guardan aqui como datos estaticos: se calculan en cada corrida por
// tests/regression/knowledgeBattery.test.ts contra el motor REAL
// (findKnowledgeBaseMatch / mockAskAssistant), para que el resultado sea
// siempre reproducible desde el codigo actual y nunca quede desactualizado
// respecto a el.
export interface KnowledgeBatteryCase {
  id: string;
  bateria: "conocida" | "nueva" | "congelada";
  idioma: "es" | "en";
  texto: string;
  entradaEsperada: string | null;
}

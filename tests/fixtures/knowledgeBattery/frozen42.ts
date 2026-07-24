import type { KnowledgeBatteryCase } from "./types";

// Bateria "congelada": 42 preguntas COMPLETAMENTE NUEVAS introducidas en
// Sprint 3, disenadas especificamente para probar sinonimos ES/EN, plural/
// singular, orden de palabras, variaciones verbales y preguntas
// comparativas, balanceadas 21 ES / 21 EN. Incluye 2 preguntas de control
// (sin relacion electrica) que deliberadamente no deben tener respuesta.
export const FROZEN_42: KnowledgeBatteryCase[] = [
  { id: "frozen-01", bateria: "congelada", idioma: "es", texto: "¿Necesito protección GFCI en el tomacorriente del garage?", entradaEsperada: "kb-gfci" },
  { id: "frozen-02", bateria: "congelada", idioma: "en", texto: "Is GFCI protection needed at the receptacle in the garage?", entradaEsperada: "kb-gfci" },
  { id: "frozen-03", bateria: "congelada", idioma: "en", texto: "For lighting, is a switch required at the entrance of every room?", entradaEsperada: "kb-general-lighting" },
  { id: "frozen-04", bateria: "congelada", idioma: "es", texto: "¿Quién puede supervisar la instalación eléctrica en Texas?", entradaEsperada: "kb-tdlr-texas" },
  { id: "frozen-05", bateria: "congelada", idioma: "en", texto: "Who is authorized to supervise electrical work under a TDLR license?", entradaEsperada: "kb-tdlr-texas" },
  { id: "frozen-06", bateria: "congelada", idioma: "es", texto: "¿En qué se diferencia el grounding del bonding?", entradaEsperada: "kb-bonding" },
  { id: "frozen-07", bateria: "congelada", idioma: "en", texto: "How does bonding differ from grounding?", entradaEsperada: "kb-bonding" },
  { id: "frozen-08", bateria: "congelada", idioma: "es", texto: "¿Cuántos circuitos para pequeños electrodomésticos necesita una cocina?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "frozen-09", bateria: "congelada", idioma: "en", texto: "How many dedicated circuits does a kitchen need for small appliances?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "frozen-10", bateria: "congelada", idioma: "es", texto: "¿A qué distancia del lavabo debe estar el tomacorriente del baño?", entradaEsperada: "kb-bathroom-receptacles" },
  { id: "frozen-11", bateria: "congelada", idioma: "en", texto: "How far from the sink should the bathroom outlet be installed?", entradaEsperada: "kb-bathroom-receptacles" },
  { id: "frozen-12", bateria: "congelada", idioma: "es", texto: "¿Qué cubierta necesita el enchufe de la terraza?", entradaEsperada: "kb-exterior-wet-locations" },
  { id: "frozen-13", bateria: "congelada", idioma: "en", texto: "What cover is needed for a porch receptacle?", entradaEsperada: "kb-exterior-wet-locations" },
  { id: "frozen-14", bateria: "congelada", idioma: "es", texto: "¿Qué interruptor necesito para el aire acondicionado?", entradaEsperada: "kb-hvac-electrical" },
  { id: "frozen-15", bateria: "congelada", idioma: "en", texto: "What circuit breaker is needed for the HVAC unit?", entradaEsperada: "kb-hvac-electrical" },
  { id: "frozen-16", bateria: "congelada", idioma: "es", texto: "¿Cuál es el tamaño mínimo de la acometida para una casa unifamiliar?", entradaEsperada: "kb-residential-service" },
  { id: "frozen-17", bateria: "congelada", idioma: "en", texto: "What is the minimum service size for a single dwelling?", entradaEsperada: "kb-residential-service" },
  { id: "frozen-18", bateria: "congelada", idioma: "es", texto: "Antes de un upgrade de 150A a 200A, ¿qué debo revisar del panel?", entradaEsperada: "kb-panel-upgrade" },
  { id: "frozen-19", bateria: "congelada", idioma: "es", texto: "¿Qué espacio de trabajo necesito frente al tablero eléctrico?", entradaEsperada: "kb-panel-working-space" },
  { id: "frozen-20", bateria: "congelada", idioma: "en", texto: "How much working space is needed in front of the panelboard?", entradaEsperada: "kb-panel-working-space" },
  { id: "frozen-21", bateria: "congelada", idioma: "es", texto: "¿El cargador EV necesita un breaker dedicado de qué amperaje?", entradaEsperada: "kb-ev-chargers" },
  { id: "frozen-22", bateria: "congelada", idioma: "en", texto: "What breaker size does an EV charger need?", entradaEsperada: "kb-ev-chargers" },
  { id: "frozen-23", bateria: "congelada", idioma: "es", texto: "¿Cómo se conecta el neutro con la tierra en un tablero secundario?", entradaEsperada: "kb-feeder-subpanel-aluminum" },
  { id: "frozen-24", bateria: "congelada", idioma: "en", texto: "How is neutral connected to ground in a secondary panel?", entradaEsperada: "kb-feeder-subpanel-aluminum" },
  { id: "frozen-25", bateria: "congelada", idioma: "es", texto: "¿Qué receptáculos a prueba de manipulación se requieren en dormitorios?", entradaEsperada: "kb-receptacle-spacing-tr" },
  { id: "frozen-26", bateria: "congelada", idioma: "en", texto: "Are tamper-resistant outlets required in bedrooms?", entradaEsperada: "kb-receptacle-spacing-tr" },
  { id: "frozen-27", bateria: "congelada", idioma: "es", texto: "¿Los interruptores AFCI se requieren en qué habitaciones de una vivienda?", entradaEsperada: "kb-afci" },
  { id: "frozen-28", bateria: "congelada", idioma: "en", texto: "In which rooms are AFCI breakers required in a dwelling?", entradaEsperada: "kb-afci" },
  { id: "frozen-29", bateria: "congelada", idioma: "es", texto: "¿Qué artículo del NEC regula la unión de las tuberías de agua?", entradaEsperada: "kb-bonding" },
  { id: "frozen-30", bateria: "congelada", idioma: "en", texto: "What NEC article governs bonding of water piping?", entradaEsperada: "kb-bonding" },
  { id: "frozen-31", bateria: "congelada", idioma: "es", texto: "¿Cuál es la puesta a tierra recomendada para un servicio nuevo?", entradaEsperada: "kb-grounding" },
  { id: "frozen-32", bateria: "congelada", idioma: "en", texto: "What grounding electrode is recommended for a new service?", entradaEsperada: "kb-grounding" },
  { id: "frozen-33", bateria: "congelada", idioma: "es", texto: "¿La nevera puede compartir el circuito de countertop de la cocina?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "frozen-34", bateria: "congelada", idioma: "en", texto: "Can the refrigerator share the kitchen countertop circuit?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "frozen-35", bateria: "congelada", idioma: "es", texto: "¿Cuántos amperios de MCA soporta un compresor típico de HVAC?", entradaEsperada: "kb-hvac-electrical" },
  { id: "frozen-36", bateria: "congelada", idioma: "en", texto: "Where do I find the MCA rating for HVAC equipment?", entradaEsperada: "kb-hvac-electrical" },
  { id: "frozen-37", bateria: "congelada", idioma: "es", texto: "¿Cuál es la diferencia entre un lugar húmedo y uno mojado?", entradaEsperada: "kb-exterior-wet-locations" },
  { id: "frozen-38", bateria: "congelada", idioma: "en", texto: "What is the difference between a damp location and a wet location?", entradaEsperada: "kb-exterior-wet-locations" },
  { id: "frozen-39", bateria: "congelada", idioma: "es", texto: "¿La licencia para supervisar trabajo eléctrico debe estar vigente?", entradaEsperada: "kb-tdlr-texas" },
  { id: "frozen-40", bateria: "congelada", idioma: "en", texto: "Does TDLR require continuing education to renew an electrician license?", entradaEsperada: "kb-tdlr-texas" },
  { id: "frozen-41", bateria: "congelada", idioma: "es", texto: "¿Qué color prefieres para pintar una pared?", entradaEsperada: null },
  { id: "frozen-42", bateria: "congelada", idioma: "en", texto: "What is a good recipe for chocolate cake?", entradaEsperada: null }
];

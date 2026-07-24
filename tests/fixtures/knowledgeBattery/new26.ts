import type { KnowledgeBatteryCase } from "./types";

// Bateria "nueva": 26 preguntas nuevas sobre los 6 temas agregados en
// Sprint 2 (introducidas en Sprint 2, reutilizadas sin cambios en Sprint 3).
export const NEW_26: KnowledgeBatteryCase[] = [
  { id: "new-01", bateria: "nueva", idioma: "es", texto: "¿A qué distancia máxima puede estar un receptáculo de otro en la pared de una sala?", entradaEsperada: "kb-receptacle-spacing-tr" },
  { id: "new-02", bateria: "nueva", idioma: "en", texto: "Do all dwelling unit receptacles need to be tamper-resistant?", entradaEsperada: "kb-receptacle-spacing-tr" },
  { id: "new-03", bateria: "nueva", idioma: "es", texto: "¿Qué significa que un receptáculo sea a prueba de manipulación?", entradaEsperada: "kb-receptacle-spacing-tr" },
  { id: "new-04", bateria: "nueva", idioma: "en", texto: "How far apart can receptacles be placed along a wall?", entradaEsperada: "kb-receptacle-spacing-tr" },
  { id: "new-05", bateria: "nueva", idioma: "es", texto: "¿Puede el mismo circuito de countertop alimentar la nevera?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "new-06", bateria: "nueva", idioma: "en", texto: "What is the maximum distance between kitchen countertop receptacles?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "new-07", bateria: "nueva", idioma: "es", texto: "¿Cuántos circuitos dedicados necesita una cocina residencial como mínimo?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "new-08", bateria: "nueva", idioma: "en", texto: "Do island receptacles in a kitchen need special rules?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "new-09", bateria: "nueva", idioma: "es", texto: "¿El circuito de countertop puede alimentar también las luces de la cocina?", entradaEsperada: "kb-kitchen-receptacles" },
  { id: "new-10", bateria: "nueva", idioma: "es", texto: "¿El receptáculo del baño puede compartir circuito con la iluminación de otro baño?", entradaEsperada: "kb-bathroom-receptacles" },
  { id: "new-11", bateria: "nueva", idioma: "en", texto: "How close to the bathroom sink must the receptacle be installed?", entradaEsperada: "kb-bathroom-receptacles" },
  { id: "new-12", bateria: "nueva", idioma: "es", texto: "¿Puedo instalar un receptáculo dentro de la ducha?", entradaEsperada: "kb-bathroom-receptacles" },
  { id: "new-13", bateria: "nueva", idioma: "en", texto: "What GFCI protection is required for a bathroom outlet?", entradaEsperada: "kb-gfci" },
  { id: "new-14", bateria: "nueva", idioma: "es", texto: "¿Puedo usar el espacio frente al panel para guardar herramientas?", entradaEsperada: "kb-panel-working-space" },
  { id: "new-15", bateria: "nueva", idioma: "en", texto: "What is the minimum width of the working space required for a panel?", entradaEsperada: "kb-panel-working-space" },
  { id: "new-16", bateria: "nueva", idioma: "es", texto: "¿Qué altura mínima se requiere sobre el panel eléctrico?", entradaEsperada: "kb-panel-working-space" },
  { id: "new-17", bateria: "nueva", idioma: "en", texto: "Can ductwork be installed above an electrical panel?", entradaEsperada: "kb-panel-working-space" },
  { id: "new-18", bateria: "nueva", idioma: "es", texto: "¿Cuántos desconectadores de servicio se pueden agrupar como máximo?", entradaEsperada: "kb-residential-service" },
  { id: "new-19", bateria: "nueva", idioma: "en", texto: "What determines the final size of a residential electrical service?", entradaEsperada: "kb-residential-service" },
  { id: "new-20", bateria: "nueva", idioma: "es", texto: "¿Un desconectador de servicio es lo mismo que un breaker del panel de distribución?", entradaEsperada: "kb-residential-service" },
  { id: "new-21", bateria: "nueva", idioma: "en", texto: "Does every service disconnect need to be marked?", entradaEsperada: "kb-residential-service" },
  { id: "new-22", bateria: "nueva", idioma: "es", texto: "¿Dónde debo leer el MCA de una unidad condensadora?", entradaEsperada: "kb-hvac-electrical" },
  { id: "new-23", bateria: "nueva", idioma: "en", texto: "Can the breaker exceed the MOCP marked on the HVAC nameplate?", entradaEsperada: "kb-hvac-electrical" },
  { id: "new-24", bateria: "nueva", idioma: "es", texto: "¿El disconnect del HVAC debe estar a la vista del equipo?", entradaEsperada: "kb-hvac-electrical" },
  { id: "new-25", bateria: "nueva", idioma: "en", texto: "How is the conductor size determined for HVAC equipment?", entradaEsperada: "kb-hvac-electrical" },
  { id: "new-26", bateria: "nueva", idioma: "en", texto: "Is a permit typically required for HVAC equipment replacement?", entradaEsperada: "kb-hvac-electrical" }
];

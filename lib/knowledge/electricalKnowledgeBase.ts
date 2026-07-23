import type { RiskLevel } from "../db/types";
import { findBestMatch, normalizeForMatch, type MatchCategory } from "./matchEngine";

export type { MatchCategory };

// Base de conocimiento electrica interna de Fly Electric Solutions LLC.
//
// IMPORTANTE (legal/seguridad):
// - Este archivo NO reproduce el texto oficial del NEC, NFPA 70E, NFPA 99,
//   TDLR ni del Houston Permitting Center. Todo el contenido esta escrito
//   en palabras propias, como un resumen/guia preliminar interna, y cada
//   entrada incluye una referencia al articulo/norma correspondiente para
//   que el usuario verifique el texto oficial completo.
// - No sustituye el codigo oficial vigente, el juicio del Master
//   Electrician con licencia TDLR, ni la aprobacion del AHJ local.
// - No cargar aqui PDFs, capturas ni copias literales de codigos con
//   derechos de autor (NEC/NFPA son publicaciones protegidas de NFPA).
//
// IMPORTANTE (matching): cada entrada declara una matchCategory obligatoria
// (ver lib/knowledge/matchEngine.ts). El match ya NO se decide por una sola
// palabra clave generica: se calcula un score ponderado por entrada, sujeto
// a un minimo, a gates de categoria (ej. "healthcare" exige mencionar
// hospital/paciente/clinica) y a penalizaciones por terminos contradictorios
// (ej. "exterior" penaliza fuertemente cualquier entrada de healthcare). Si
// ninguna entrada supera el umbral de confianza, findKnowledgeBaseMatch
// devuelve null: no se reutiliza contenido generico ni relacionado solo por
// una palabra.

export type KnowledgeSourceType = "regla_tecnica_general" | "guia_interna_general" | "checklist_operativo";

export interface KnowledgeBaseEntry {
  id: string;
  matchCategory: MatchCategory;
  category: string;
  keywords: string[];
  // Terminos contradictorios especificos de esta entrada (ademas de los que
  // ya aplica el gate de su categoria en matchEngine.ts): si aparecen en la
  // pregunta, penalizan fuertemente el score de esta entrada en particular.
  excludeTerms?: string[];
  codeReference: string;
  sourceType: KnowledgeSourceType;
  shortAnswerEs: string;
  shortAnswerEn: string;
  // Sprint 2: desglose tecnico opcional, mas largo que shortAnswer, para
  // entradas donde conviene separar la respuesta directa de la explicacion
  // completa. Opcional y retrocompatible: las 21 entradas anteriores a
  // Sprint 2 no lo usan (siguen con todo el detalle dentro de shortAnswer,
  // como ya lo hacian) y se comportan exactamente igual. Cuando esta
  // presente, mockAssistant.ts lo anexa a shortAnswer/englishSummary.
  explanationEs?: string;
  explanationEn?: string;
  riskLevel: RiskLevel;
  checklistEs: string[];
  checklistEn: string[];
  // Sprint 2: errores comunes de campo, distintos de un checklist de
  // verificacion (son advertencias sobre practicas incorrectas frecuentes,
  // no pasos a confirmar). Opcional; cuando esta presente, mockAssistant.ts
  // los anexa al checklist visible con el prefijo "Error comun".
  commonMistakesEs?: string[];
  commonMistakesEn?: string[];
  missingQuestionsEs: string[];
  missingQuestionsEn: string[];
  recommendationEs: string;
  recommendationEn: string;
  warningEs: string;
  warningEn: string;
}

export const ELECTRICAL_KNOWLEDGE_BASE: KnowledgeBaseEntry[] = [
  {
    id: "kb-healthcare-517",
    matchCategory: "healthcare",
    category: "Healthcare / Hospitales (NEC 517)",
    keywords: [
      "hospital",
      "hospitales",
      "healthcare",
      "health care",
      "nec 517",
      "articulo 517",
      "517",
      "nfpa 99",
      "tomas",
      "receptaculos",
      "hospital grade",
      "patient bed",
      "area de atencion al paciente",
      "patient care area",
      "tomas en hospitales",
      "tomas de hospital",
      "receptaculos en hospitales",
      "que tipo de tomas se usan en hospitales"
    ],
    codeReference: "NEC 2023 Article 517 (Health Care Facilities) y NFPA 99 (Health Care Facilities Code)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "En areas de atencion al paciente se usan receptaculos hospital grade (grado hospitalario, identificados con un punto verde), que tienen contactos reforzados y una conexion a tierra mas confiable que un receptaculo estandar. El NEC Article 517 (junto con NFPA 99) clasifica los espacios por nivel de riesgo: las areas de cuidado general de pacientes y las areas de cuidado critico tienen requisitos distintos de cantidad de receptaculos, respaldo de emergencia y puesta a tierra. Cada 'patient bed location' (ubicacion de cama de paciente) normalmente requiere un numero minimo de receptaculos hospital grade con puesta a tierra redundante. Ademas, muchas instalaciones hospitalarias tienen un sistema electrico esencial dividido en ramales: normal (alimentado por el servicio electrico normal), critico (equipos criticos con respaldo de emergencia) y de seguridad de vida (life safety branch, para iluminacion de salidas, alarmas y equipos criticos de seguridad). El tipo exacto de toma y el ramal que la alimenta dependen de la categoria de riesgo del espacio (Category 1 para areas de mayor exigencia como quirofanos, Category 2 para cuidado general de pacientes) segun NFPA 99. Esta es una guia preliminar: el tipo de toma exacto, la cantidad y el ramal siempre deben confirmarse contra el plano electrico, el panel schedule del proyecto, el Master Electrician y el AHJ correspondiente.",
    shortAnswerEn:
      "Patient care areas use hospital grade receptacles (identified by a green dot), which have reinforced contacts and a more reliable grounding connection than a standard receptacle. NEC Article 517 (together with NFPA 99) classifies spaces by risk level: general care patient areas and critical care patient areas have different requirements for receptacle count, emergency backup, and grounding. Each patient bed location typically requires a minimum number of hospital grade receptacles with redundant grounding. Many health care facilities also have an essential electrical system split into branches: normal (fed by the normal electrical service), critical (critical equipment with emergency backup), and life safety (exit lighting, alarms, and critical safety equipment). The exact receptacle type and which branch feeds it depend on the risk category of the space (Category 1 for higher-acuity spaces like operating rooms, Category 2 for general patient care) per NFPA 99. This is a preliminary guide only: the exact receptacle type, quantity, and branch must always be confirmed against the project's electrical drawings, panel schedule, the Master Electrician, and the AHJ.",
    riskLevel: "alto",
    checklistEs: [
      "Confirmar que el espacio es un 'patient care area' segun el plano y la clasificacion del proyecto",
      "Verificar que los receptaculos especificados sean hospital grade (marcados con punto verde)",
      "Contar el numero de receptaculos requeridos por cada patient bed location",
      "Confirmar si el area es de cuidado general o critico (Category 1 / Category 2 segun NFPA 99)",
      "Identificar que ramal alimenta cada circuito (normal, critico o life safety) en el panel schedule",
      "Verificar puesta a tierra redundante y continuidad de tierra en receptaculos hospital grade"
    ],
    checklistEn: [
      "Confirm the space is a patient care area per the drawings and project classification",
      "Verify the specified receptacles are hospital grade (green dot marked)",
      "Count the required number of receptacles per patient bed location",
      "Confirm whether the area is general care or critical care (Category 1 / Category 2 per NFPA 99)",
      "Identify which branch feeds each circuit (normal, critical, or life safety) on the panel schedule",
      "Verify redundant grounding and ground continuity on hospital grade receptacles"
    ],
    missingQuestionsEs: [
      "Hoja del plano y panel schedule del area de atencion al paciente",
      "Categoria de riesgo del espacio (Category 1, 2, 3 o 4 segun NFPA 99)",
      "Si el proyecto tiene sistema electrico esencial (normal, critico, life safety) y su panel schedule",
      "Numero exacto de patient bed locations en el area"
    ],
    missingQuestionsEn: [
      "Drawing sheet and panel schedule for the patient care area",
      "Risk category of the space (Category 1, 2, 3, or 4 per NFPA 99)",
      "Whether the project has an essential electrical system (normal, critical, life safety) and its panel schedule",
      "Exact number of patient bed locations in the area"
    ],
    recommendationEs:
      "Este es trabajo especializado de alto riesgo (vida/seguridad de pacientes). Escalar al Master Electrician antes de cotizar, disenar o instalar cualquier circuito en un area de atencion al paciente, y confirmar los requisitos exactos con el ingeniero de registro del proyecto y el AHJ.",
    recommendationEn:
      "This is specialized, high-risk work (patient life safety). Escalate to the Master Electrician before quoting, designing, or installing any circuit in a patient care area, and confirm exact requirements with the project's engineer of record and the AHJ.",
    warningEs:
      "Esta respuesta es una guia preliminar interna de Fly Electric Solutions LLC en base a NEC 2023, NFPA 99 y practica general; no reemplaza el texto oficial completo del NEC Article 517 ni NFPA 99. El trabajo en instalaciones de salud requiere verificacion obligatoria con el Master Electrician, el ingeniero de registro y el AHJ antes de proceder.",
    warningEn:
      "This is a preliminary internal guide from Fly Electric Solutions LLC based on NEC 2023, NFPA 99, and general practice; it does not replace the full official text of NEC Article 517 or NFPA 99. Health care facility work requires mandatory verification with the Master Electrician, the engineer of record, and the AHJ before proceeding."
  },
  {
    id: "kb-healthcare-lighting",
    matchCategory: "healthcare",
    category: "Healthcare / Iluminacion hospitalaria (NEC 517)",
    keywords: [
      "iluminacion hospitalaria",
      "iluminacion en hospitales",
      "iluminacion de hospital",
      "luces en hospitales",
      "luminarias en hospitales",
      "hospital lighting",
      "healthcare lighting",
      "patient care lighting",
      "iluminacion de emergencia",
      "emergency lighting",
      "egress lighting",
      "iluminacion de salida",
      // Terminos sueltos de bajo peso (1pt cada uno): por si solos nunca
      // alcanzan minimumScore, pero permiten que preguntas como "que
      // iluminacion se usa en hospitales" (que no arma ninguna de las
      // frases exactas de arriba) combinen dos senales validas -
      // iluminacion + hospital- y superen el umbral igual, sin depender de
      // un pre-chequeo hardcodeado de una sola palabra.
      "iluminacion",
      "hospital",
      "hospitales"
    ],
    codeReference: "NEC 2023 Article 517 (Health Care Facilities, iluminacion en patient care areas) y NFPA 99 (life safety branch)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "La iluminacion en areas de atencion al paciente se divide normalmente segun el sistema electrico esencial: iluminacion general (ramal normal o critico, segun el circuito) e iluminacion de seguridad de vida (life safety branch), que cubre salidas, rutas de egreso y senalizacion de emergencia y debe permanecer operativa incluso si falla el servicio normal. Ademas de la clasificacion por ramal, se debe considerar iluminacion de tarea cerca de cada patient bed location (para exploracion clinica) y, en areas de mayor riesgo (Category 1 segun NFPA 99, como quirofanos), niveles y respaldo de iluminacion mas exigentes que en areas de cuidado general (Category 2). Esta es una guia preliminar: el circuito, ramal y nivel de iluminacion exactos siempre deben confirmarse contra el plano electrico (hoja de iluminacion / E1.1), el panel schedule, el Master Electrician y el AHJ.",
    shortAnswerEn:
      "Lighting in patient care areas is typically split according to the essential electrical system: general lighting (normal or critical branch, depending on the circuit) and life safety branch lighting, which covers exits, egress paths, and emergency signage and must stay operational even if normal power fails. Beyond branch classification, task lighting near each patient bed location (for clinical examination) should be considered, and higher-acuity areas (Category 1 per NFPA 99, such as operating rooms) typically require more demanding lighting levels and backup than general care areas (Category 2). This is a preliminary guide only: the exact circuit, branch, and lighting level must always be confirmed against the electrical drawings (lighting sheet / E1.1), the panel schedule, the Master Electrician, and the AHJ.",
    riskLevel: "alto",
    checklistEs: [
      "Confirmar en el plano si la luminaria esta en el ramal normal, critico o de life safety",
      "Verificar iluminacion de salidas y rutas de egreso (life safety branch)",
      "Confirmar iluminacion de tarea cerca de cada patient bed location",
      "Confirmar categoria de riesgo del espacio (Category 1 / Category 2 segun NFPA 99)",
      "Verificar respaldo de emergencia (generador/UPS) para la iluminacion critica"
    ],
    checklistEn: [
      "Confirm on the drawings whether the fixture is on the normal, critical, or life safety branch",
      "Verify exit and egress path lighting (life safety branch)",
      "Confirm task lighting near each patient bed location",
      "Confirm the space's risk category (Category 1 / Category 2 per NFPA 99)",
      "Verify emergency backup (generator/UPS) for critical lighting"
    ],
    missingQuestionsEs: [
      "Hoja de iluminacion del plano (ej. E1.1) del area de atencion al paciente",
      "Categoria de riesgo del espacio (Category 1, 2, 3 o 4 segun NFPA 99)",
      "Si el circuito de iluminacion esta en el ramal normal, critico o life safety"
    ],
    missingQuestionsEn: [
      "Lighting drawing sheet (e.g. E1.1) for the patient care area",
      "Risk category of the space (Category 1, 2, 3, or 4 per NFPA 99)",
      "Whether the lighting circuit is on the normal, critical, or life safety branch"
    ],
    recommendationEs:
      "Trabajo especializado de alto riesgo (seguridad de vida). Escalar al Master Electrician antes de disenar o instalar iluminacion en un area de atencion al paciente, y confirmar el ramal exacto con el ingeniero de registro y el AHJ.",
    recommendationEn:
      "Specialized, high-risk work (life safety). Escalate to the Master Electrician before designing or installing lighting in a patient care area, and confirm the exact branch with the engineer of record and the AHJ.",
    warningEs:
      "Guia preliminar interna basada en NEC 2023 y NFPA 99; no reemplaza el texto oficial completo del NEC Article 517 ni NFPA 99. Verificar con el Master Electrician, el ingeniero de registro y el AHJ antes de proceder.",
    warningEn:
      "Preliminary internal guide based on NEC 2023 and NFPA 99; it does not replace the full official text of NEC Article 517 or NFPA 99. Verify with the Master Electrician, the engineer of record, and the AHJ before proceeding."
  },
  {
    id: "kb-general-lighting",
    matchCategory: "lighting",
    category: "Iluminacion general (no hospitalaria)",
    excludeTerms: ["hospital", "hospitales", "paciente", "patient care", "nec 517", "nfpa 99"],
    keywords: [
      "iluminacion",
      "iluminacion general",
      "luminaria",
      "luminarias",
      "luces",
      "lighting",
      "light fixture",
      "punto de luz",
      "circuito de iluminacion",
      // Sprint 1: antes esta entrada tenia solo 2 keywords en ingles
      // ("lighting", "light fixture") contra 7 en espanol, lo que media una
      // asimetria real de idioma (mismas preguntas en ingles puntuaban 1,
      // en espanol 3-4). Se agregan equivalentes en ingles para las mismas
      // senales que ya existen en espanol (carga, circuito, control, y
      // ubicacion de switch/entrada).
      "lighting load",
      "lighting circuit",
      "wall switch",
      "room entrance",
      "general lighting",
      "load per square foot",
      // Sprint 2 (Parte 2, fallo demostrado): "room entrance" no matcheaba
      // "entrance of a room" (mismo concepto, orden de palabras invertido -
      // el matching es por subcadena literal, sin tolerancia de orden).
      "entrance of a room",
      "entrance of the room"
    ],
    codeReference: "NEC Article 210 (branch circuits) y Article 410 (luminaires); referencia general",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Para un circuito de iluminacion general (residencial o comercial, sin contexto hospitalario) se debe confirmar: el circuito dedicado o compartido que alimenta la luminaria, el control (switch sencillo, 3 vias, dimmer), si la luminaria es para interior, exterior o area humeda/mojada (listado adecuado), y la carga total del circuito para no exceder el breaker. Espacios humedos, exteriores o cerca de agua requieren luminarias listadas para esa ubicacion.",
    shortAnswerEn:
      "For a general lighting circuit (residential or commercial, no health care context) confirm: whether the fixture is on a dedicated or shared circuit, the control type (single-pole switch, 3-way, dimmer), whether the fixture is rated for interior, exterior, or damp/wet locations, and the circuit's total load so the breaker isn't exceeded. Damp, exterior, or near-water locations require fixtures listed for that location.",
    riskLevel: "bajo",
    checklistEs: [
      "Confirmar tipo de control (switch sencillo, 3 vias, dimmer)",
      "Confirmar si la ubicacion es interior, exterior o humeda/mojada",
      "Verificar listado de la luminaria para esa ubicacion",
      "Confirmar carga total del circuito de iluminacion"
    ],
    checklistEn: [
      "Confirm control type (single-pole switch, 3-way, dimmer)",
      "Confirm whether the location is interior, exterior, or damp/wet",
      "Verify the fixture's listing for that location",
      "Confirm the lighting circuit's total load"
    ],
    missingQuestionsEs: ["Ubicacion exacta de la luminaria", "Tipo de control deseado"],
    missingQuestionsEn: ["Exact fixture location", "Desired control type"],
    recommendationEs: "Confirmar el listado de la luminaria para la ubicacion exacta antes de instalar, especialmente en exteriores o areas humedas.",
    recommendationEn: "Confirm the fixture's listing for the exact location before installing, especially outdoors or in damp areas.",
    warningEs: "Guia general interna; verificar el articulo NEC exacto y la aprobacion del Master Electrician antes de instalar.",
    warningEn: "General internal guide; verify the exact NEC article and Master Electrician approval before installing."
  },
  {
    id: "kb-hospital-grade-receptacles",
    matchCategory: "healthcare",
    category: "Hospital grade receptacles",
    keywords: [
      "hospital grade",
      "grado hospitalario",
      "punto verde",
      "green dot",
      "hospital-grade receptacle",
      "receptaculo hospital grade"
    ],
    codeReference: "NEC Article 517.18 / 517.19 (grounding-type receptacles in patient care areas) y listado UL para hospital grade",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Un receptaculo hospital grade es un receptaculo listado especificamente para uso en areas de atencion al paciente: tiene contactos con mayor presion de retencion (menos probabilidad de que el enchufe se afloje), una construccion mas robusta, y esta probado para una conexion a tierra mas confiable que un receptaculo comercial estandar. Se identifica visualmente por un punto verde en la cara del dispositivo. El NEC lo exige en la mayoria de patient care areas, en cantidad minima por cama de paciente, y normalmente conectado con un conductor de puesta a tierra dedicado o redundante.",
    shortAnswerEn:
      "A hospital grade receptacle is a receptacle specifically listed for use in patient care areas: it has contacts with higher retention force (less likely for a plug to loosen), a more robust construction, and is tested for a more reliable grounding connection than a standard commercial receptacle. It is visually identified by a green dot on the device face. The NEC requires it in most patient care areas, in a minimum quantity per patient bed, typically wired with a dedicated or redundant grounding conductor.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar que el receptaculo especificado tiene listado UL como hospital grade",
      "Verificar el punto verde visible en la cara del dispositivo",
      "Confirmar tipo de conductor de puesta a tierra (dedicado o redundante) segun el plano",
      "Probar la retencion del contacto y la continuidad de tierra antes de cerrar el trabajo"
    ],
    checklistEn: [
      "Confirm the specified receptacle has a UL listing as hospital grade",
      "Verify the visible green dot on the device face",
      "Confirm the grounding conductor type (dedicated or redundant) per the drawings",
      "Test contact retention and ground continuity before closing out the work"
    ],
    missingQuestionsEs: ["Ubicacion exacta (area de cuidado general o critico)", "Si el circuito requiere puesta a tierra redundante"],
    missingQuestionsEn: ["Exact location (general care or critical care area)", "Whether the circuit requires redundant grounding"],
    recommendationEs:
      "Usar unicamente receptaculos con listado hospital grade en areas de atencion al paciente; confirmar con el Master Electrician si el proyecto exige ademas puesta a tierra redundante.",
    recommendationEn:
      "Use only hospital grade listed receptacles in patient care areas; confirm with the Master Electrician whether the project also requires redundant grounding.",
    warningEs:
      "Guia preliminar interna basada en NEC 2023 y practica general; verificar el articulo oficial y el listado UL especifico del producto antes de instalar.",
    warningEn:
      "Preliminary internal guide based on NEC 2023 and general practice; verify the official article and the product's specific UL listing before installing."
  },
  {
    id: "kb-patient-bed-locations",
    matchCategory: "healthcare",
    category: "Patient bed locations",
    keywords: [
      "patient bed location",
      "ubicacion de cama del paciente",
      "cama del paciente",
      "general care area",
      "critical care area",
      "area de cuidado critico",
      "area de cuidado general"
    ],
    codeReference: "NEC Article 517.18 (general care areas) y 517.19 (critical care areas)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Un 'patient bed location' es la ubicacion designada donde se coloca la cama de un paciente dentro de un area de atencion. El NEC distingue entre areas de cuidado general (general care) y areas de cuidado critico (critical care), y cada tipo tiene su propio requisito minimo de receptaculos hospital grade y de puesta a tierra por ubicacion de cama. Las areas de cuidado critico generalmente tienen requisitos mas estrictos (mas receptaculos, puesta a tierra redundante, y respaldo del sistema electrico esencial) porque ahi se conecta equipo de soporte de vida.",
    shortAnswerEn:
      "A patient bed location is the designated spot where a patient's bed is placed within a care area. The NEC distinguishes between general care areas and critical care areas, and each type has its own minimum requirement for hospital grade receptacles and grounding per bed location. Critical care areas generally have stricter requirements (more receptacles, redundant grounding, and essential electrical system backup) because life-support equipment is connected there.",
    riskLevel: "alto",
    checklistEs: [
      "Identificar cada patient bed location en el plano",
      "Confirmar si es area de cuidado general o critico",
      "Contar receptaculos hospital grade requeridos por cama",
      "Verificar si la ubicacion requiere alimentacion del sistema electrico esencial"
    ],
    checklistEn: [
      "Identify each patient bed location on the drawings",
      "Confirm whether it is a general care or critical care area",
      "Count required hospital grade receptacles per bed",
      "Verify whether the location requires essential electrical system backup"
    ],
    missingQuestionsEs: ["Clasificacion exacta del area segun el ingeniero de registro", "Cantidad de camas por cuarto"],
    missingQuestionsEn: ["Exact area classification per the engineer of record", "Number of beds per room"],
    recommendationEs: "Confirmar la clasificacion del area con el ingeniero de registro y el Master Electrician antes de definir cantidad de receptaculos.",
    recommendationEn: "Confirm the area classification with the engineer of record and the Master Electrician before defining receptacle quantities.",
    warningEs: "Guia preliminar interna; la clasificacion final del espacio la determina el diseno del proyecto y el AHJ, no este asistente.",
    warningEn: "Preliminary internal guide; the final space classification is determined by the project design and the AHJ, not this assistant."
  },
  {
    id: "kb-gfci",
    matchCategory: "receptacles",
    category: "GFCI",
    keywords: [
      "gfci",
      "ground fault",
      "falla a tierra",
      "gfci protection",
      "proteccion gfci",
      "receptaculo gfci",
      "gfci receptacle",
      // Sprint 1 - fortalecimiento de recuperacion bilingue: sinonimos y
      // ubicaciones naturales que antes solo dejaban "gfci" (1pt) como unico
      // termino coincidente, sin llegar a MINIMUM_SCORE=2.
      "garaje",
      "garage",
      "enchufe",
      "toma de corriente",
      "outlet",
      "test button",
      "boton de prueba",
      "boton de test",
      // Sprint 2: la entrada nueva kb-bathroom-receptacles (Parte 1) tambien
      // matchea "receptaculo del bano", y una pregunta centrada en GFCI que
      // ademas menciona el receptaculo del bano (regresion real detectada:
      // "necesito proteccion gfci en el receptaculo del bano cerca del
      // fregadero") debe seguir resolviendo a GFCI, no a la entrada nueva.
      "receptaculo del bano"
    ],
    codeReference: "NEC Article 210.8 (GFCI protection for personnel)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "La proteccion GFCI (falla a tierra) se exige generalmente en receptaculos de banos, cocinas cerca de countertops, garajes, exteriores, sotanos no terminados y a menos de 6 pies de un fregadero. El GFCI detecta una fuga de corriente hacia tierra y desconecta el circuito para proteger a las personas de choque electrico. La ubicacion exacta, el tipo de ocupacion (residencial o comercial) y la edicion del codigo adoptada por el AHJ determinan el requisito final.",
    shortAnswerEn:
      "GFCI protection is generally required for receptacles in bathrooms, kitchens near countertops, garages, exteriors, unfinished basements, and within 6 feet of a sink. GFCI detects current leakage to ground and disconnects the circuit to protect people from electric shock. The exact location, occupancy type (residential or commercial), and the code edition adopted by the AHJ determine the final requirement.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar ubicacion exacta del receptaculo",
      "Confirmar distancia a fregadero o fuente de agua",
      "Verificar si el receptaculo es interior o exterior",
      "Probar el boton de test/reset del GFCI instalado"
    ],
    checklistEn: [
      "Confirm the exact receptacle location",
      "Confirm distance to a sink or water source",
      "Verify whether the receptacle is interior or exterior",
      "Test the installed GFCI's test/reset button"
    ],
    missingQuestionsEs: ["Ubicacion exacta del receptaculo (bano, cocina, garage, exterior, etc.)", "Tipo de ocupacion (residencial o comercial)"],
    missingQuestionsEn: ["Exact receptacle location (bathroom, kitchen, garage, exterior, etc.)", "Occupancy type (residential or commercial)"],
    recommendationEs: "Continuar con la instalacion aplicando GFCI si la ubicacion corresponde a un area requerida; documentar la ubicacion en el reporte.",
    recommendationEn: "Proceed with the installation applying GFCI if the location corresponds to a required area; document the location in the report.",
    warningEs: "Guia general interna; verificar el articulo NEC exacto, la edicion adoptada por el AHJ y la aprobacion del Master Electrician.",
    warningEn: "General internal guide; verify the exact NEC article, the edition adopted by the AHJ, and Master Electrician approval."
  },
  {
    id: "kb-afci",
    matchCategory: "panels",
    category: "AFCI",
    keywords: [
      "afci",
      "arc fault",
      "falla de arco",
      "interruptor de falla de arco",
      "combination afci",
      // Sprint 1: ubicaciones tipicas de vivienda (dormitorio/bedroom, area
      // habitable) y las formas "combinado/estandar" que la pregunta natural
      // usa al comparar tipos de breaker, antes ausentes de las keywords.
      "dormitorio",
      "bedroom",
      "habitable room",
      "cuarto habitable",
      "combinado",
      "estandar",
      "standard",
      "combined afci",
      // Sprint 2 (Parte 2, fallo demostrado): "en que circuitos se requiere
      // AFCI en una vivienda" solo puntuaba 1 (bare "afci"). "vivienda" es
      // combinable de bajo peso, igual que "dormitorio"/"bedroom" arriba.
      "vivienda"
    ],
    codeReference: "NEC Article 210.12 (Arc-Fault Circuit-Interrupter Protection)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "La proteccion AFCI (falla de arco) detecta patrones de arco electrico peligrosos (por ejemplo, en un cable danado) y desconecta el circuito para prevenir incendios. Se exige tipicamente en circuitos de iluminacion y receptaculos de areas habitables de vivienda (dormitorios, salas, pasillos, etc.), usualmente con un breaker combination AFCI en el panel. Algunos circuitos pueden requerir GFCI y AFCI al mismo tiempo (proteccion dual) dependiendo de la ubicacion.",
    shortAnswerEn:
      "AFCI (arc-fault) protection detects dangerous arcing patterns (for example, in a damaged cable) and disconnects the circuit to help prevent fires. It is typically required for lighting and receptacle circuits in dwelling unit living areas (bedrooms, living rooms, hallways, etc.), usually with a combination AFCI breaker at the panel. Some circuits may require both GFCI and AFCI protection (dual protection) depending on the location.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar si el circuito alimenta un area habitable de vivienda",
      "Verificar si se requiere proteccion combinada (AFCI + GFCI) segun la ubicacion",
      "Confirmar tipo de breaker instalado (combination AFCI)",
      "Probar el boton de test del AFCI"
    ],
    checklistEn: [
      "Confirm whether the circuit feeds a dwelling unit living area",
      "Verify whether combined protection (AFCI + GFCI) is required for the location",
      "Confirm the installed breaker type (combination AFCI)",
      "Test the AFCI's test button"
    ],
    missingQuestionsEs: ["Tipo de ocupacion (vivienda unifamiliar, multifamiliar, comercial)", "Ubicacion exacta del circuito"],
    missingQuestionsEn: ["Occupancy type (single-family, multifamily, commercial)", "Exact circuit location"],
    recommendationEs: "Instalar breaker combination AFCI donde aplique y documentar la ubicacion; confirmar con el Master Electrician si el area requiere proteccion dual.",
    recommendationEn: "Install a combination AFCI breaker where applicable and document the location; confirm with the Master Electrician whether the area requires dual protection.",
    warningEs: "Guia general interna; verificar el articulo NEC exacto y la edicion adoptada por el AHJ antes de finalizar la instalacion.",
    warningEn: "General internal guide; verify the exact NEC article and the edition adopted by the AHJ before finalizing the installation."
  },
  {
    id: "kb-grounding",
    matchCategory: "grounding_bonding",
    category: "Grounding",
    keywords: ["grounding", "puesta a tierra", "electrodo de tierra", "grounding electrode"],
    codeReference: "NEC Article 250 (Grounding and Bonding)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "El grounding (puesta a tierra) conecta el sistema electrico a un electrodo de tierra (varilla, Ufer/electrodo empotrado en concreto, o tuberia metalica de agua) para dar una trayectoria de baja impedancia hacia tierra en caso de falla. Se debe verificar el tipo de electrodo disponible, el calibre correcto del conductor de puesta a tierra segun el tamano del servicio, y la continuidad electrica de todo el sistema antes de energizar.",
    shortAnswerEn:
      "Grounding connects the electrical system to a grounding electrode (rod, Ufer/concrete-encased electrode, or metal water pipe) to provide a low-impedance path to ground in the event of a fault. Verify the available electrode type, the correct grounding conductor size for the service size, and the electrical continuity of the entire system before energizing.",
    riskLevel: "alto",
    checklistEs: [
      "Verificar electrodo de puesta a tierra presente y accesible",
      "Verificar calibre del grounding electrode conductor",
      "Confirmar bonding de tuberia de agua metalica",
      "Verificar continuidad electrica con multimetro"
    ],
    checklistEn: [
      "Verify the grounding electrode is present and accessible",
      "Verify the grounding electrode conductor size",
      "Confirm bonding of the metal water pipe",
      "Verify electrical continuity with a multimeter"
    ],
    missingQuestionsEs: ["Tipo de electrodo disponible en sitio", "Tamano del servicio electrico"],
    missingQuestionsEn: ["Type of electrode available on site", "Electrical service size"],
    recommendationEs: "Riesgo alto (shock electrico / fire hazard si falla). Escalar al Master Electrician para verificacion final antes de energizar.",
    recommendationEn: "High risk (electric shock / fire hazard if it fails). Escalate to the Master Electrician for final verification before energizing.",
    warningEs: "Guia general interna; verificar el articulo NEC exacto y confirmar con el Master Electrician antes de energizar el sistema.",
    warningEn: "General internal guide; verify the exact NEC article and confirm with the Master Electrician before energizing the system."
  },
  {
    id: "kb-bonding",
    matchCategory: "grounding_bonding",
    category: "Bonding",
    keywords: [
      "bonding",
      "union equipotencial",
      "bonding jumper",
      "puente de bonding",
      // Sprint 2 (Parte 2, fallo demostrado): la pregunta comparativa
      // "diferencia entre grounding y bonding" empataba 1/1 con kb-grounding
      // y ninguna cruzaba el umbral. El contenido de ESTA entrada ya explica
      // la diferencia explicitamente, asi que la frase comparativa completa
      // se agrega aqui (no en kb-grounding) para desempatar sin ambiguedad.
      "diferencia entre grounding y bonding",
      "difference between grounding and bonding"
    ],
    codeReference: "NEC Article 250, Part V (Bonding)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "El bonding conecta electricamente partes metalicas normalmente sin corriente (como tuberias de agua/gas, gabinetes de panel, o carcasas de equipo) para que todas queden al mismo potencial electrico y no representen riesgo de choque si una de ellas se energiza por falla. Es distinto del grounding: el grounding conecta el sistema a tierra fisica, mientras que el bonding conecta partes metalicas entre si. Se debe confirmar el bonding jumper del panel (si es subpanel), el bonding de tuberia de agua y gas, y la continuidad de todas las partes metalicas bonded.",
    shortAnswerEn:
      "Bonding electrically connects normally non-current-carrying metal parts (such as water/gas piping, panel enclosures, or equipment frames) so they stay at the same electrical potential and don't create a shock hazard if one becomes energized due to a fault. It is different from grounding: grounding connects the system to physical earth, while bonding connects metal parts to each other. Confirm the panel's bonding jumper (if it's a subpanel), water and gas pipe bonding, and continuity of all bonded metal parts.",
    riskLevel: "alto",
    checklistEs: [
      "Confirmar bonding jumper en el panel si es subpanel",
      "Confirmar bonding de tuberia de agua metalica",
      "Confirmar bonding de tuberia de gas si aplica",
      "Verificar continuidad electrica entre todas las partes metalicas bonded"
    ],
    checklistEn: [
      "Confirm the panel's bonding jumper if it is a subpanel",
      "Confirm bonding of the metal water pipe",
      "Confirm gas pipe bonding if applicable",
      "Verify electrical continuity between all bonded metal parts"
    ],
    missingQuestionsEs: ["Es panel principal o subpanel", "Tipo de tuberias presentes en el sitio (metalicas o no metalicas)"],
    missingQuestionsEn: ["Is it a main panel or a subpanel", "Type of piping present on site (metallic or non-metallic)"],
    recommendationEs: "Riesgo alto si el bonding esta incompleto. Escalar al Master Electrician para verificacion final antes de cerrar el trabajo.",
    recommendationEn: "High risk if bonding is incomplete. Escalate to the Master Electrician for final verification before closing out the work.",
    warningEs: "Guia general interna; verificar el articulo NEC exacto (Article 250, Part V) antes de aprobar el trabajo.",
    warningEn: "General internal guide; verify the exact NEC article (Article 250, Part V) before approving the work."
  },
  {
    id: "kb-ev-chargers",
    matchCategory: "ev_charging",
    category: "EV Chargers",
    keywords: ["ev charger", "cargador ev", "electric vehicle", "carro electrico", "coche electrico", "estacion de carga"],
    codeReference: "NEC Article 625 (Electric Vehicle Power Transfer System) y regla general de 125% para carga continua",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Un EV charger se trata como una carga continua: el breaker y el conductor deben dimensionarse para al menos 125% de la carga continua del charger (por ejemplo, 48A x 1.25 = 60A, por lo que se usaria un breaker dedicado de 60A). Se debe confirmar el amperaje real de placa del equipo, que el circuito sea dedicado, la capacidad disponible en el panel segun el ultimo load calculation, y si el AHJ local exige permiso para la instalacion.",
    shortAnswerEn:
      "An EV charger is treated as a continuous load: the breaker and conductor must be sized for at least 125% of the charger's continuous load (for example, 48A x 1.25 = 60A, so a dedicated 60A breaker would be used). Confirm the equipment's actual nameplate amperage, that the circuit is dedicated, the available panel capacity per the latest load calculation, and whether the local AHJ requires a permit for the installation.",
    riskLevel: "alto",
    checklistEs: [
      "Confirmar amperaje real de placa del EV charger",
      "Confirmar que el circuito es dedicado (sin otras cargas)",
      "Verificar calibre de conductor para 125% de la carga continua",
      "Verificar capacidad disponible en el panel (load calculation)",
      "Verificar si se requiere permiso local para EV charger"
    ],
    checklistEn: [
      "Confirm the EV charger's actual nameplate amperage",
      "Confirm the circuit is dedicated (no other loads)",
      "Verify conductor size for 125% of the continuous load",
      "Verify available panel capacity (load calculation)",
      "Verify whether a local permit is required for the EV charger"
    ],
    missingQuestionsEs: ["Ciudad / jurisdiccion (AHJ)", "Amperaje exacto de placa del cargador", "Capacidad disponible en el panel segun ultimo load calculation"],
    missingQuestionsEn: ["City / jurisdiction (AHJ)", "Charger's exact nameplate amperage", "Available panel capacity per the latest load calculation"],
    recommendationEs: "Documentar los datos de placa del charger y el load calculation antes de continuar. Escalar al Master Electrician por ser un circuito de alto riesgo.",
    recommendationEn: "Document the charger's nameplate data and the load calculation before proceeding. Escalate to the Master Electrician as this is a high-risk circuit.",
    warningEs: "Guia general interna; verificar el articulo NEC exacto y la aprobacion del Master Electrician antes de instalar.",
    warningEn: "General internal guide; verify the exact NEC article and Master Electrician approval before installing."
  },
  {
    id: "kb-feeder-subpanel-aluminum",
    matchCategory: "feeders",
    category: "Alimentador a tablero secundario / conductores de aluminio (NEC Article 215)",
    keywords: [
      "alimentador",
      "feeder",
      "tablero secundario",
      "subpanel",
      "sub panel",
      "panel secundario",
      "aluminio",
      "aluminum",
      "conductor de aluminio",
      "conductores de aluminio",
      "neutro aislado",
      "isolated neutral",
      "barra de tierra separada",
      "separate ground bar",
      "caida de voltaje",
      "voltage drop",
      "calibre de alimentador",
      "feeder conductor",
      "alimentar un tablero",
      "alimentar el tablero",
      "acometida o alimentador",
      // Sprint 1: la entrada ya explica en su respuesta que el neutro debe
      // quedar aislado en el subpanel (NEC 250.24(A)(5)/408.40-41), pero
      // ninguna keyword cubria la forma natural en que se pregunta esto
      // ("se conectan juntos" / "hay que separarlos").
      "neutro y tierra juntos",
      "separar neutro y tierra",
      "neutral and ground bonded",
      "neutral-ground separation",
      "subpanel bonding",
      // Sprint 2 (Parte 2, fallo demostrado): las frases de Sprint 1 exigian
      // coincidencia exacta y la pregunta real intercala palabras
      // ("el neutro Y LA tierra... SE CONECTAN juntos" / "neutral and
      // ground BE bonded together"). Se agregan anclas mas cortas y
      // robustas a esa insercion de palabras.
      "neutro y la tierra",
      "neutral and ground"
    ],
    codeReference:
      "NEC Article 215 (Feeders), 310.12 (tabla reducida para vivienda - solo si el alimentador abastece la carga COMPLETA de la vivienda), Table 310.16 (ampacidad estandar), 110.14(A)/(B) (terminales y compuesto antioxidante condicional), NEC Chapter 9 Tables 1/4/5 (conduit fill), Article 352.10(F) (PVC Schedule 80 en ubicaciones expuestas a daño fisico), Informational Note de caida de voltaje en 210.19(A)/215.2(A), 250.24(A)(5)/408.40-408.41 (neutro y bonding), 300.5/300.9 (ubicaciones humedas)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Antes de dar un calibre final de conductor, calibre de tierra, tamaño de tuberia o una lista de materiales, esta consulta tiene varias preguntas pendientes (ver 'Preguntas faltantes' abajo): lo siguiente es el marco de decision, no un resultado ya cerrado. 1) Calibre del conductor (NEC 310.12 vs Table 310.16): NO existe un calibre 'universal' para 200A, y 4/0 AWG aluminio y 250 kcmil aluminio NO son intercambiables sin verificar cual tabla aplica. NEC 310.12 (tabla reducida, ~83% de la corriente nominal) SOLO se puede usar cuando el alimentador abastece la carga COMPLETA de la vivienda unifamiliar (no un subpanel parcial, no un garaje separado, no una adicion) Y no se requieren factores de ajuste o correccion; en ese caso, 4/0 AWG aluminio es una opcion tipica para 200A. Si el alimentador NO abastece la carga completa de la vivienda -que es lo mas comun para un 'tablero secundario'/subpanel- o si aplican factores de ajuste (temperatura ambiente elevada, mas de 3 conductores portadores de corriente en la misma tuberia, etc.), el calibre se determina con NEC Table 310.16 segun el rating de temperatura de los terminales (60°C/75°C), el tipo de aislamiento del conductor (ej. THWN-2/XHHW-2), la temperatura ambiente real y los factores de correccion/ajuste aplicables; esto puede resultar en un calibre mayor, como 250 kcmil aluminio o mas. 2) Caida de voltaje: no se puede dar un porcentaje (ej. 'aprox. 1%') sin la carga calculada real, la corriente usada, el conductor exacto evaluado, la temperatura considerada, el factor de potencia de la carga, y un calculo separado para la porcion de 120V (linea-neutro) y la de 240V (linea-linea) del circuito. El NEC no exige un limite de caida de voltaje como regla general obligatoria: el 3% (ramal) / 5% (total) es una Informational Note (recomendacion) en 210.19(A)/215.2(A), no una regla dura, salvo que el AHJ o el diseño del proyecto la exijan explicitamente. 3) Tamaño de tuberia (conduit fill): no se selecciona un tamaño (ej. '2 pulgadas') sin calcular el llenado real con NEC Chapter 9 Tables 1, 4 y 5, segun la cantidad de conductores, su calibre, el tipo de aislamiento y el material de la tuberia. 4) Material de tuberia: no se recomienda PVC Schedule 40 de forma general. Debe confirmarse si el recorrido es interior, exterior, enterrado o expuesto: donde la tuberia quede expuesta a daño fisico se requiere PVC Schedule 80 (NEC 352.10(F) - Schedule 40 no esta identificado para esa condicion) u otro metodo listado equivalente. 5) Compuesto antioxidante: se menciona SOLO si las instrucciones o el listado del fabricante de las terminales/conectores lo requieren o lo permiten explicitamente; no es un requisito general del NEC ni un paso automatico. En el tablero secundario, ademas, el neutro debe quedar AISLADO del gabinete (barra de neutro flotante) y el EGC debe conectarse a una barra de tierra separada bonded al gabinete (NEC 250.24(A)(5) y 408.40/408.41): el neutro y la tierra solo se unen en el primer medio de desconexion del servicio.",
    shortAnswerEn:
      "Before giving a final conductor size, grounding conductor size, conduit size, or a materials list, this question has several pending items (see 'Missing questions' below): the following is the decision framework, not a closed result. 1) Conductor size (NEC 310.12 vs Table 310.16): there is NO 'universal' size for 200A, and 4/0 AWG aluminum and 250 kcmil aluminum are NOT interchangeable without verifying which table applies. NEC 310.12 (the reduced ~83% table) can ONLY be used when the feeder supplies the ENTIRE load of the one-family dwelling (not a partial subpanel, not a detached garage, not an addition) AND no adjustment or correction factors are required; in that case, 4/0 AWG aluminum is a typical option for 200A. If the feeder does NOT supply the entire dwelling load -which is the most common case for a 'subpanel'- or if adjustment factors apply (elevated ambient temperature, more than 3 current-carrying conductors in the same raceway, etc.), the size is determined using NEC Table 310.16 based on the terminal temperature rating (60°C/75°C), the conductor's insulation type (e.g. THWN-2/XHHW-2), the actual ambient temperature, and applicable correction/adjustment factors; this can result in a larger size, such as 250 kcmil aluminum or more. 2) Voltage drop: a percentage (e.g. 'approx. 1%') cannot be given without the actual calculated load, the current used, the exact conductor evaluated, the temperature considered, the load's power factor, and a separate calculation for the 120V (line-to-neutral) and 240V (line-to-line) portions of the circuit. The NEC does not mandate a voltage drop limit as a general rule: the 3% (branch)/5% (total) figure is an Informational Note (recommendation) in 210.19(A)/215.2(A), not a hard rule, unless the AHJ or the project design explicitly requires it. 3) Conduit size (conduit fill): a size (e.g. '2 inches') is not selected without calculating actual fill using NEC Chapter 9 Tables 1, 4, and 5, based on the number of conductors, their size, insulation type, and raceway material. 4) Raceway material: PVC Schedule 40 is not recommended generically. It must be confirmed whether the run is interior, exterior, underground, or exposed: where the raceway is exposed to physical damage, PVC Schedule 80 is required (NEC 352.10(F) - Schedule 40 is not identified for that condition) or another equivalent listed method. 5) Antioxidant compound: mentioned ONLY if the terminal/connector manufacturer's instructions or listing require or explicitly permit it; it is not a general NEC requirement or an automatic step. At the subpanel, the neutral must also be ISOLATED from the enclosure (floating neutral bar) and the EGC must connect to a separate ground bar bonded to the enclosure (NEC 250.24(A)(5) and 408.40/408.41): the neutral and ground are only bonded together at the first service disconnecting means.",
    riskLevel: "alto",
    checklistEs: [
      "Confirmar si el alimentador abastece la carga COMPLETA de la vivienda (requisito para NEC 310.12) o solo una parte",
      "Si 310.12 no aplica: calcular calibre con Table 310.16 + rating de terminales + aislamiento + temperatura ambiente + factores de ajuste",
      "No presentar 4/0 AWG Al y 250 kcmil Al como intercambiables sin resolver el punto anterior",
      "Calcular caida de voltaje con carga real, corriente, conductor exacto, temperatura y factor de potencia, por separado para 120V y 240V",
      "Confirmar si el 3%/5% es una recomendacion (Informational Note) o un requisito exigido por el AHJ/diseño del proyecto",
      "Calcular conduit fill con NEC Chapter 9 Tables 1/4/5 antes de indicar un tamaño de tuberia",
      "Confirmar si el recorrido es interior, exterior, enterrado o expuesto, y usar PVC Schedule 80 (u equivalente) si hay riesgo de daño fisico",
      "Verificar si el fabricante de las terminales/conectores exige o permite compuesto antioxidante antes de indicarlo",
      "Confirmar 4 conductores: dos calientes, un neutro aislado y un EGC dedicado a barra de tierra separada",
      "No emitir lista final de materiales hasta resolver todas las preguntas pendientes"
    ],
    checklistEn: [
      "Confirm whether the feeder supplies the ENTIRE dwelling load (required for NEC 310.12) or only part of it",
      "If 310.12 does not apply: size using Table 310.16 + terminal rating + insulation + ambient temperature + adjustment factors",
      "Do not present 4/0 AWG Al and 250 kcmil Al as interchangeable without resolving the item above",
      "Calculate voltage drop with actual load, current, exact conductor, temperature, and power factor, separately for 120V and 240V",
      "Confirm whether the 3%/5% figure is a recommendation (Informational Note) or a requirement imposed by the AHJ/project design",
      "Calculate conduit fill using NEC Chapter 9 Tables 1/4/5 before specifying a conduit size",
      "Confirm whether the run is interior, exterior, underground, or exposed, and use PVC Schedule 80 (or equivalent) if exposed to physical damage",
      "Verify whether the terminal/connector manufacturer requires or permits antioxidant compound before specifying it",
      "Confirm 4 conductors: two hots, an isolated neutral, and a dedicated EGC to a separate ground bar",
      "Do not issue a final materials list until all pending questions are resolved"
    ],
    missingQuestionsEs: [
      "El alimentador abastece la carga COMPLETA de la vivienda o solo una parte (subpanel parcial, garaje separado, adicion)",
      "Tipo de aislamiento exacto del conductor (ej. THWN-2, XHHW-2) y rating de temperatura de los terminales (60°C o 75°C)",
      "Temperatura ambiente real del recorrido y numero de conductores portadores de corriente en la misma tuberia",
      "Si el recorrido es interior, exterior, enterrado o expuesto a daño fisico",
      "Carga calculada real (amperios) y factor de potencia, para el calculo de caida de voltaje",
      "Si el fabricante de las terminales/conectores requiere o permite compuesto antioxidante"
    ],
    missingQuestionsEn: [
      "Whether the feeder supplies the ENTIRE dwelling load or only part of it (partial subpanel, detached garage, addition)",
      "Exact conductor insulation type (e.g. THWN-2, XHHW-2) and terminal temperature rating (60°C or 75°C)",
      "Actual ambient temperature of the run and number of current-carrying conductors in the same raceway",
      "Whether the run is interior, exterior, underground, or exposed to physical damage",
      "Actual calculated load (amperage) and power factor, for the voltage drop calculation",
      "Whether the terminal/connector manufacturer requires or permits antioxidant compound"
    ],
    recommendationEs:
      "No se puede emitir un calibre final de conductor, tierra, tamaño de tuberia ni una lista de materiales sin resolver las preguntas pendientes. Escalar al Master Electrician para el calculo final (310.12 vs Table 310.16, conduit fill, caida de voltaje) antes de cotizar o instalar.",
    recommendationEn:
      "A final conductor size, grounding conductor size, conduit size, or materials list cannot be issued without resolving the pending questions. Escalate to the Master Electrician for the final calculation (310.12 vs Table 310.16, conduit fill, voltage drop) before quoting or installing.",
    warningEs:
      "Guia preliminar interna basada en NEC 2023 y practica general; no reemplaza el texto oficial completo del NEC. El calibre final de conductor y de tierra, el tamaño de tuberia, y la aprobacion del alimentador, requieren verificacion del Master Electrician y del AHJ antes de instalar.",
    warningEn:
      "Preliminary internal guide based on NEC 2023 and general practice; it does not replace the full official NEC text. The final conductor and grounding conductor size, conduit size, and feeder approval require Master Electrician and AHJ verification before installing."
  },
  {
    id: "kb-panel-upgrade",
    matchCategory: "panels",
    category: "Panel Upgrade",
    keywords: ["panel upgrade", "cambiar panel", "upgrade de panel", "actualizacion de panel", "cambio de panel", "150a", "200a"],
    codeReference: "NEC Article 220 (load calculations), Article 250 (grounding and bonding), Article 110.26 (working space)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Antes de un panel upgrade (por ejemplo de 150A a 200A) se debe verificar el load calculation actualizado, la capacidad del feeder/service entrance existente, el grounding electrode system, el bonding de tuberias de agua/gas, el clearance de trabajo frente al panel, y coordinar el corte de servicio con la utility. Es trabajo de servicio principal y se considera de alto riesgo.",
    shortAnswerEn:
      "Before a panel upgrade (for example from 150A to 200A), verify the updated load calculation, existing feeder/service entrance capacity, the grounding electrode system, water/gas pipe bonding, working clearance in front of the panel, and coordinate the service disconnect with the utility. This is main service work and is considered high risk.",
    riskLevel: "alto",
    checklistEs: [
      "Load calculation actualizado para la nueva capacidad",
      "Verificar capacidad del feeder/conductor de acometida",
      "Revisar grounding electrode system",
      "Confirmar bonding de tuberia de agua y gas",
      "Verificar clearance de trabajo minimo",
      "Coordinar corte de servicio con la utility",
      "Verificar permiso del AHJ correspondiente"
    ],
    checklistEn: [
      "Updated load calculation for the new capacity",
      "Verify feeder/service entrance conductor capacity",
      "Review the grounding electrode system",
      "Confirm water and gas pipe bonding",
      "Verify minimum working clearance",
      "Coordinate service disconnect with the utility",
      "Verify the applicable AHJ permit"
    ],
    missingQuestionsEs: ["Ciudad / jurisdiccion (AHJ)", "Calibre del conductor de acometida actual", "Ultimo load calculation disponible"],
    missingQuestionsEn: ["City / jurisdiction (AHJ)", "Current service entrance conductor size", "Latest available load calculation"],
    recommendationEs: "Escalar al Master Electrician antes de cotizar o ejecutar: es trabajo de servicio principal / alto riesgo.",
    recommendationEn: "Escalate to the Master Electrician before quoting or executing: this is main service / high-risk work.",
    warningEs: "Guia general interna; verificar el articulo NEC exacto y los requisitos del AHJ antes de ejecutar.",
    warningEn: "General internal guide; verify the exact NEC article and AHJ requirements before executing."
  },
  {
    id: "kb-load-calculation",
    matchCategory: "services",
    category: "Load Calculation",
    keywords: [
      "load calculation",
      "calculo de carga",
      "cargas calculadas",
      "demand factor",
      "factor de demanda",
      // Sprint 2 (Parte 2, fallo demostrado): "carga total de una vivienda"
      // es una parafrasis natural de "calculo de carga" que no coincidia
      // con ninguna keyword exacta existente.
      "carga total"
    ],
    codeReference: "NEC Article 220 (Branch-Circuit, Feeder, and Service Load Calculations)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "El load calculation determina la carga total esperada de una instalacion para dimensionar correctamente el servicio, el feeder y el panel. Existen metodos estandar y opcionales segun el tipo de ocupacion, que aplican factores de demanda a distintas categorias de carga (iluminacion general, electrodomesticos, HVAC, motores, etc.). Un load calculation desactualizado es una de las causas mas comunes de rechazo en inspeccion cuando se agregan cargas nuevas (como un EV charger o un panel upgrade).",
    shortAnswerEn:
      "The load calculation determines a project's total expected load in order to correctly size the service, feeder, and panel. Standard and optional methods exist depending on occupancy type, applying demand factors to different load categories (general lighting, appliances, HVAC, motors, etc.). An outdated load calculation is one of the most common causes of inspection rejection when new loads are added (such as an EV charger or a panel upgrade).",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar tipo de ocupacion (residencial o comercial)",
      "Listar todas las cargas existentes y nuevas a agregar",
      "Confirmar metodo de calculo aplicable (estandar u opcional)",
      "Verificar que el resultado no exceda la capacidad del servicio/feeder"
    ],
    checklistEn: [
      "Confirm occupancy type (residential or commercial)",
      "List all existing and new loads to be added",
      "Confirm the applicable calculation method (standard or optional)",
      "Verify the result does not exceed service/feeder capacity"
    ],
    missingQuestionsEs: ["Tipo de ocupacion", "Cargas nuevas a agregar y su amperaje", "Ultimo load calculation existente si hay uno"],
    missingQuestionsEn: ["Occupancy type", "New loads to be added and their amperage", "Latest existing load calculation, if any"],
    recommendationEs: "Solicitar o generar un load calculation actualizado antes de agregar cargas nuevas o cotizar un panel upgrade.",
    recommendationEn: "Request or generate an updated load calculation before adding new loads or quoting a panel upgrade.",
    warningEs: "Guia general interna; el load calculation final debe ser preparado o revisado por el Master Electrician o el ingeniero de registro.",
    warningEn: "General internal guide; the final load calculation should be prepared or reviewed by the Master Electrician or the engineer of record."
  },
  {
    id: "kb-conduit-fill",
    matchCategory: "installation_methods",
    category: "Conduit Fill",
    keywords: ["conduit fill", "llenado de conduit", "relleno de tuberia", "porcentaje de llenado", "fill de tuberia"],
    codeReference: "NEC Chapter 9, Tables 1 y 4 (Conduit and Tubing Fill)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "El conduit fill limita cuantos conductores caben dentro de una tuberia segun su diametro, para permitir disipacion de calor y facilitar el tendido de cable sin danar el aislamiento. Como referencia general (verificar siempre en tabla oficial): 1 conductor permite hasta ~53% de llenado, 2 conductores hasta ~31%, y 3 o mas conductores hasta ~40% del area interior de la tuberia. El porcentaje exacto depende del tipo de conduit, el tipo de conductor y su calibre, por lo que siempre se debe usar la tabla oficial del NEC Chapter 9 para el calculo final.",
    shortAnswerEn:
      "Conduit fill limits how many conductors fit inside a raceway based on its diameter, allowing for heat dissipation and easier cable pulling without damaging insulation. As a general reference (always verify against the official table): 1 conductor allows up to ~53% fill, 2 conductors up to ~31%, and 3 or more conductors up to ~40% of the raceway's interior area. The exact percentage depends on the conduit type, conductor type, and conductor size, so the official NEC Chapter 9 tables should always be used for the final calculation.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar tipo y diametro de conduit especificado",
      "Confirmar numero, tipo y calibre de conductores a instalar",
      "Calcular porcentaje de llenado con la tabla oficial NEC Chapter 9",
      "Verificar si se requiere ajuste por derating (numero de conductores portadores de corriente)"
    ],
    checklistEn: [
      "Confirm the specified conduit type and diameter",
      "Confirm the number, type, and size of conductors to be installed",
      "Calculate fill percentage using the official NEC Chapter 9 tables",
      "Verify whether derating is required (number of current-carrying conductors)"
    ],
    missingQuestionsEs: ["Tipo de conduit (EMT, PVC, rigido, etc.)", "Diametro del conduit", "Numero, tipo y calibre de conductores"],
    missingQuestionsEn: ["Conduit type (EMT, PVC, rigid, etc.)", "Conduit diameter", "Number, type, and size of conductors"],
    recommendationEs: "Usar siempre la tabla oficial del NEC Chapter 9 para el calculo final; este resumen es solo una referencia rapida orientativa.",
    recommendationEn: "Always use the official NEC Chapter 9 tables for the final calculation; this summary is only a quick orientation reference.",
    warningEs: "Guia general interna; los porcentajes exactos varian por tipo de conduit y conductor. Verificar la tabla oficial antes de instalar.",
    warningEn: "General internal guide; exact percentages vary by conduit and conductor type. Verify the official table before installing."
  },
  {
    id: "kb-box-fill",
    matchCategory: "installation_methods",
    category: "Box Fill",
    keywords: ["box fill", "llenado de caja", "capacidad de caja", "volumen de caja"],
    codeReference: "NEC Article 314.16 (Number of Conductors in Outlet, Device, and Junction Boxes)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "El box fill determina cuantos conductores, dispositivos y accesorios (clamps, grapas) puede contener una caja electrica sin sobrecargarla fisicamente, para permitir espacio de trabajo seguro y evitar dano al aislamiento. Cada conductor, dispositivo (como un receptaculo o switch) y clamp interno cuenta como un volumen especifico segun el calibre del conductor, y ese volumen total no debe exceder la capacidad marcada de la caja.",
    shortAnswerEn:
      "Box fill determines how many conductors, devices, and fittings (clamps, staples) an electrical box can contain without physically overloading it, allowing safe working space and preventing insulation damage. Each conductor, device (such as a receptacle or switch), and internal clamp counts as a specific volume based on the conductor size, and that total volume must not exceed the box's marked capacity.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar capacidad marcada de la caja (o dimensiones si no esta marcada)",
      "Contar conductores, dispositivos y clamps segun las reglas de conteo",
      "Confirmar calibre de los conductores involucrados",
      "Verificar que el total no exceda la capacidad de la caja"
    ],
    checklistEn: [
      "Confirm the box's marked capacity (or dimensions if unmarked)",
      "Count conductors, devices, and clamps per the counting rules",
      "Confirm the gauge of the conductors involved",
      "Verify the total does not exceed the box's capacity"
    ],
    missingQuestionsEs: ["Tipo y tamano de caja especificada", "Numero y calibre de conductores que entran a la caja"],
    missingQuestionsEn: ["Type and size of the specified box", "Number and gauge of conductors entering the box"],
    recommendationEs: "Recalcular el box fill si se agregan conductores o dispositivos adicionales a una caja existente.",
    recommendationEn: "Recalculate box fill if additional conductors or devices are added to an existing box.",
    warningEs: "Guia general interna; verificar el articulo NEC exacto y las reglas de conteo antes de finalizar la instalacion.",
    warningEn: "General internal guide; verify the exact NEC article and counting rules before finalizing the installation."
  },
  {
    id: "kb-houston-ahj",
    matchCategory: "houston_ahj",
    category: "Houston AHJ",
    keywords: ["houston ahj", "houston permitting", "permitting center", "permiso houston", "autoridad local", "houston public works"],
    codeReference: "Houston Permitting Center / AHJ local",
    sourceType: "guia_interna_general",
    shortAnswerEs:
      "La autoridad local competente (AHJ) determina el codigo exacto adoptado, el proceso de permiso y los requisitos de inspeccion para un proyecto. En Houston, el Houston Permitting Center exige permiso para la mayoria de trabajos de panel upgrade, subpaneles, EV chargers y trabajo de servicio principal. El AHJ tambien puede tener requisitos adicionales locales mas estrictos que el NEC base.",
    shortAnswerEn:
      "The local authority having jurisdiction (AHJ) determines the exact code edition adopted, the permit process, and inspection requirements for a project. In Houston, the Houston Permitting Center requires a permit for most panel upgrade, subpanel, EV charger, and main service work. The AHJ may also have additional local requirements stricter than the base NEC.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar la ciudad / jurisdiccion exacta del proyecto",
      "Verificar si el trabajo requiere permiso antes de iniciar",
      "Confirmar la edicion del codigo adoptada por el AHJ",
      "Agendar la inspeccion una vez el trabajo este listo"
    ],
    checklistEn: [
      "Confirm the exact city / jurisdiction of the project",
      "Verify whether the work requires a permit before starting",
      "Confirm the code edition adopted by the AHJ",
      "Schedule inspection once the work is ready"
    ],
    missingQuestionsEs: ["Ciudad / jurisdiccion (AHJ)", "Tipo de trabajo a permisar"],
    missingQuestionsEn: ["City / jurisdiction (AHJ)", "Type of work to be permitted"],
    recommendationEs: "Verificar el requisito de permiso vigente directamente con Houston Permitting Center o el AHJ correspondiente antes de cotizar o ejecutar.",
    recommendationEn: "Verify the current permit requirement directly with the Houston Permitting Center or the applicable AHJ before quoting or executing.",
    warningEs: "Guia interna general; los requisitos de permiso e inspeccion cambian por jurisdiccion. Confirmar siempre con el AHJ vigente.",
    warningEn: "General internal guide; permit and inspection requirements vary by jurisdiction. Always confirm with the current AHJ."
  },
  {
    id: "kb-tdlr-texas",
    matchCategory: "tdlr",
    category: "TDLR Texas",
    keywords: [
      "tdlr",
      "licencia texas",
      "texas department of licensing",
      "master electrician license",
      "licencia de electricista",
      "supervision",
      // Sprint 1: "supervision" (sustantivo) ya estaba, pero normalizeForMatch
      // no hace stemming, asi que la forma verbal "supervisar" (pregunta real:
      // "que licencia se requiere para supervisar trabajo electrico") no
      // coincidia. "supervise" es el verbo en ingles, tampoco presente antes.
      "supervisar",
      "supervise",
      // Sprint 2 (Parte 2, fallo demostrado): "supervisar" solo (1pt) no
      // cruzaba el umbral porque la pregunta real no dice "tdlr" ni
      // "licencia texas" de forma contigua. Se agrega la frase completa
      // "supervisar trabajo electrico" como ancla de mayor peso.
      "supervisar trabajo electrico"
    ],
    codeReference: "Reglas de licenciamiento TDLR (Texas Department of Licensing and Regulation)",
    sourceType: "guia_interna_general",
    shortAnswerEs:
      "Todo trabajo electrico en Texas debe ser realizado o supervisado por personal con licencia TDLR vigente. El Master Electrician es responsable de la supervision final y de que el trabajo cumpla con el NEC adoptado y las reglas de TDLR antes de solicitar inspeccion. El nivel de licencia debe corresponder al tipo de trabajo (residencial o comercial) y hay requisitos de educacion continua para mantenerla vigente.",
    shortAnswerEn:
      "All electrical work in Texas must be performed or supervised by personnel with a valid TDLR license. The Master Electrician is responsible for final supervision and for ensuring the work complies with the adopted NEC and TDLR rules before requesting inspection. The license level must match the type of work (residential or commercial), and continuing education is required to keep it current.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar que la licencia TDLR del Master Electrician este vigente",
      "Confirmar que el nivel de licencia cubra el tipo de trabajo",
      "Documentar quien supervisa el trabajo en sitio",
      "Verificar requisitos de continuing education si aplica"
    ],
    checklistEn: [
      "Confirm the Master Electrician's TDLR license is current",
      "Confirm the license level covers the type of work",
      "Document who supervises the work on site",
      "Verify continuing education requirements if applicable"
    ],
    missingQuestionsEs: ["Numero de licencia TDLR del Master Electrician", "Tipo de trabajo (residencial/comercial)"],
    missingQuestionsEn: ["Master Electrician's TDLR license number", "Type of work (residential/commercial)"],
    recommendationEs: "Confirmar con el Master Electrician el numero de licencia y el alcance de supervision antes de continuar.",
    recommendationEn: "Confirm the license number and scope of supervision with the Master Electrician before proceeding.",
    warningEs: "Guia interna general; verificar directamente con TDLR el estado de la licencia antes de asumir que esta vigente.",
    warningEn: "General internal guide; verify the license status directly with TDLR before assuming it is current."
  },
  {
    id: "kb-nfpa-70e",
    matchCategory: "arc_flash_safety",
    category: "NFPA 70E",
    keywords: ["nfpa 70e", "70e", "arc flash", "epp", "ppe electrico", "loto", "bloqueo y etiquetado", "lockout tagout", "bloqueo", "etiquetado"],
    codeReference: "NFPA 70E (Standard for Electrical Safety in the Workplace)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "NFPA 70E cubre las practicas de seguridad electrica en el trabajo, incluyendo LOTO (bloqueo y etiquetado), evaluacion de riesgo de arc flash, y el equipo de proteccion personal (EPP) requerido segun el nivel de riesgo. Antes de trabajar en un panel, feeder o servicio principal se debe de-energizar el circuito, aplicar LOTO visible, verificar ausencia de voltaje con un multimetro calibrado, y usar el EPP correspondiente al nivel de riesgo de arc flash del equipo.",
    shortAnswerEn:
      "NFPA 70E covers electrical safety-related work practices, including LOTO (lockout/tagout), arc flash risk assessment, and the personal protective equipment (PPE) required based on the risk level. Before working on a panel, feeder, or main service, de-energize the circuit, apply visible LOTO, verify absence of voltage with a calibrated multimeter, and use PPE appropriate to the equipment's arc flash risk level.",
    riskLevel: "critico",
    checklistEs: [
      "De-energizar el circuito antes de trabajar",
      "Aplicar bloqueo/etiquetado (LOTO) visible",
      "Verificar ausencia de voltaje con multimetro calibrado",
      "Usar EPP adecuado segun el nivel de riesgo de arc flash",
      "Escalar al Master Electrician antes de volver a energizar"
    ],
    checklistEn: [
      "De-energize the circuit before working",
      "Apply visible lockout/tagout (LOTO)",
      "Verify absence of voltage with a calibrated multimeter",
      "Use appropriate PPE based on the arc flash risk level",
      "Escalate to the Master Electrician before re-energizing"
    ],
    missingQuestionsEs: ["Tipo de panel o equipo a intervenir", "Voltaje y amperaje del servicio"],
    missingQuestionsEn: ["Type of panel or equipment to be worked on", "Service voltage and amperage"],
    recommendationEs: "Riesgo critico (shock electrico / arc flash). No energizar ni continuar sin LOTO completo y verificacion del Master Electrician.",
    recommendationEn: "Critical risk (electric shock / arc flash). Do not energize or proceed without complete LOTO and Master Electrician verification.",
    warningEs: "Guia general interna; verificar el texto oficial de NFPA 70E y la politica de seguridad de la empresa antes de trabajar energizado.",
    warningEn: "General internal guide; verify the official NFPA 70E text and the company's safety policy before working energized."
  },
  {
    id: "kb-nfpa-99",
    matchCategory: "healthcare",
    category: "NFPA 99",
    keywords: ["nfpa 99", "essential electrical system", "sistema electrico esencial", "medical gas", "gas medico", "risk category", "categoria de riesgo"],
    codeReference: "NFPA 99 (Health Care Facilities Code)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "NFPA 99 es el codigo de referencia para instalaciones de salud, y cubre desde el sistema electrico esencial (normal, critico y life safety branch) hasta sistemas de gases medicos y clasificacion de espacios por categoria de riesgo. La categoria de riesgo (Category 1 al 4) refleja que tan critico es un fallo del sistema para la seguridad del paciente: Category 1 aplica a espacios de mayor exigencia (como quirofanos), mientras que categorias mas bajas aplican a espacios administrativos o de menor riesgo clinico. El NEC Article 517 hace referencia a NFPA 99 para varios de estos requisitos.",
    shortAnswerEn:
      "NFPA 99 is the reference code for health care facilities, covering everything from the essential electrical system (normal, critical, and life safety branches) to medical gas systems and space classification by risk category. The risk category (Category 1 through 4) reflects how critical a system failure would be to patient safety: Category 1 applies to higher-acuity spaces (such as operating rooms), while lower categories apply to administrative or lower clinical-risk spaces. NEC Article 517 references NFPA 99 for several of these requirements.",
    riskLevel: "alto",
    checklistEs: [
      "Confirmar la categoria de riesgo NFPA 99 del espacio",
      "Identificar si el proyecto tiene sistema electrico esencial y sus ramales",
      "Verificar si el espacio involucra sistemas de gases medicos",
      "Confirmar requisitos especificos con el ingeniero de registro del proyecto"
    ],
    checklistEn: [
      "Confirm the NFPA 99 risk category of the space",
      "Identify whether the project has an essential electrical system and its branches",
      "Verify whether the space involves medical gas systems",
      "Confirm specific requirements with the project's engineer of record"
    ],
    missingQuestionsEs: ["Categoria de riesgo asignada por el diseno del proyecto", "Si el espacio tiene sistemas de gases medicos"],
    missingQuestionsEn: ["Risk category assigned by the project design", "Whether the space has medical gas systems"],
    recommendationEs: "Trabajo especializado de alto riesgo. Escalar al Master Electrician y confirmar con el ingeniero de registro y el AHJ antes de proceder.",
    recommendationEn: "Specialized, high-risk work. Escalate to the Master Electrician and confirm with the engineer of record and the AHJ before proceeding.",
    warningEs: "Guia preliminar interna basada en NFPA 99 y practica general; no reemplaza el texto oficial completo de NFPA 99 ni NEC Article 517.",
    warningEn: "Preliminary internal guide based on NFPA 99 and general practice; it does not replace the full official text of NFPA 99 or NEC Article 517."
  },
  {
    id: "kb-exterior-wet-locations",
    matchCategory: "exterior_wet_locations",
    category: "Receptaculos en exteriores / lugares humedos y mojados (NEC 406.9 / 210.8)",
    keywords: [
      "receptaculos exteriores",
      "receptaculo exterior",
      "tomacorriente exterior",
      "tomacorrientes exteriores",
      "outdoor receptacle",
      "outdoor receptacles",
      "lugares humedos",
      "lugares mojados",
      "ubicacion humeda",
      "ubicacion mojada",
      "wet location",
      "wet locations",
      "damp location",
      "damp locations",
      "weather-resistant",
      "weather resistant",
      "weatherproof",
      "in-use cover",
      "while-in-use",
      "extra duty",
      "extra-duty",
      "tapa in-use",
      "a prueba de intemperie",
      "a la intemperie",
      "exterior",
      "exteriores",
      "intemperie",
      // "humedo"/"mojado" (masculino) coexisten con "humeda"/"mojada"
      // (femenino, concuerda con "ubicacion"/"area"): normalizeForMatch NO
      // hace stemming, es matching por subcadena literal, asi que ambas
      // formas de genero deben listarse explicitamente. Bug real de
      // produccion (Houston, pregunta real de un electricista): "ubicacion
      // humeda o mojada" no matcheaba nada porque solo existia la forma
      // masculina.
      "humedo",
      "humeda",
      "mojado",
      "mojada",
      "gfci exterior",
      "outdoor gfci",
      // "WR" como sigla suelta: la pregunta real decia "receptaculo WR", no
      // el termino completo "weather-resistant".
      "wr",
      // "tomacorriente" es el sinonimo mas comun de "receptaculo" en
      // espanol de Texas/Houston; sin esto, cualquier pregunta que use
      // "tomacorriente" en vez de "receptaculo" pierde esta senal.
      "tomacorriente",
      "tomacorrientes",
      // Sprint 1: "patio" es la forma mas comun en que un electricista real
      // describe una ubicacion exterior residencial (mas que "exterior" o
      // "intemperie"), y no coincidia con ninguna keyword existente. "porch"
      // y "terraza" cubren las mismas ubicaciones cubiertas/semi-cubiertas
      // en ingles y espanol. "exterior outlet" (nota: "outdoor receptacle" /
      // "outdoor receptacles" ya estaban en la lista, no se duplican).
      "patio",
      "porch",
      "terraza",
      "exterior outlet",
      // Sprint 2 (Parte 2, fallo demostrado): "patio" solo (1pt) no cruzaba
      // el umbral por si solo. "receptaculo en el patio" es la frase
      // contigua real de la pregunta que fallaba; "patio receptacle" cubre
      // el equivalente en ingles pedido explicitamente.
      "receptaculo en el patio",
      "patio receptacle"
    ],
    // Terminos contradictorios propios de esta entrada, ademas del gate
    // simetrico de healthcare que ya aplica CATEGORY_GATES en matchEngine.ts.
    excludeTerms: ["hospital", "hospitales", "paciente", "patient care", "nfpa 99", "nec 517"],
    codeReference:
      "NEC 406.9(A) (lugares humedos), NEC 406.9(B)/406.9(B)(1) (lugares mojados: receptaculo weather-resistant y cubierta while-in-use extra-duty), NEC 210.8(A)(3) (GFCI en exteriores de vivienda) y NEC 210.8(F) (GFCI para salidas exteriores, NEC 2023)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Los receptaculos instalados en exteriores o en lugares humedos/mojados se rigen principalmente por NEC 406.9, con proteccion GFCI exigida por NEC 210.8. 1) Humedo (damp) vs mojado (wet): un lugar humedo es un area protegida de la lluvia directa (por ejemplo bajo un techo, porche o alero con proteccion lateral suficiente); un lugar mojado esta expuesto directamente a la lluvia o al agua (por ejemplo a la intemperie sin cubierta). La clasificacion depende de las condiciones fisicas reales del sitio, no de la palabra 'exterior' por si sola. 2) GFCI: NEC 210.8(A)(3) exige proteccion GFCI para receptaculos en exteriores dentro de la lista de ubicaciones de vivienda (dwelling units); ademas, NEC 210.8(F) (seccion dedicada a 'Outdoor Outlets' en NEC 2023) amplia el requisito de GFCI a salidas exteriores en general, hasta 50A monofasico, con excepciones puntuales (por ejemplo cierto equipo HVAC listado). En una aplicacion residencial exterior tipica (patio, jardin, cochera), el receptaculo debe tener proteccion GFCI. 3) Weather-resistant (WR): todo receptaculo no bloqueable de 15A o 20A, 125V/250V instalado en el exterior -sea humedo o mojado- debe estar listado como weather-resistant (marcado WR), segun NEC 406.9(A) para humedo y NEC 406.9(B)(1) para mojado; el marcado WR es sobre el receptaculo mismo, es un requisito aparte de la tapa. 4) Cubierta cuando NO esta en uso (lugar humedo): NEC 406.9(A) exige que la cubierta sea a prueba de intemperie solo cuando el receptaculo esta cerrado (sin el enchufe conectado); una tapa abatible estandar ('flip lid') normalmente es suficiente si el area esta protegida de la lluvia directa. 5) Cubierta while-in-use / extra-duty (lugar mojado): NEC 406.9(B)(1) exige una cubierta a prueba de intemperie incluso con el enchufe conectado ('while-in-use'), y esa capucha (outlet box hood) debe estar listada e identificada como 'extra duty'; esto aplica tipicamente a cualquier receptaculo exterior sin proteccion alguna contra la lluvia (por ejemplo en una pared exterior sin alero). 6) Aplicacion residencial: en una vivienda unifamiliar, la mayoria de los receptaculos exteriores (patio, fachada, jardin, cochera abierta) se consideran lugares mojados a menos que esten claramente protegidos por un techo/alero con cobertura lateral suficiente, por lo que en la practica se instala una cubierta extra-duty while-in-use como estandar, con receptaculo WR y proteccion GFCI. Esta es una guia interna preliminar en palabras propias (no el texto oficial del NEC): verifique la edicion exacta adoptada por el AHJ antes de instalar.",
    shortAnswerEn:
      "Receptacles installed outdoors or in damp/wet locations are governed primarily by NEC 406.9, with GFCI protection required by NEC 210.8. 1) Damp vs wet: a damp location is an area protected from direct rain (for example, under a roof, porch, or eave with sufficient side protection); a wet location is directly exposed to rain or water (for example, unprotected outdoors). The classification depends on actual site conditions, not on the word 'outdoor' alone. 2) GFCI: NEC 210.8(A)(3) requires GFCI protection for receptacles outdoors within the dwelling unit locations list; in addition, NEC 210.8(F) (a dedicated 'Outdoor Outlets' section in NEC 2023) broadens the GFCI requirement to outdoor outlets in general, up to 50A single-phase, with specific exceptions (for example, certain listed HVAC equipment). For a typical residential exterior application (patio, yard, carport), the receptacle must have GFCI protection. 3) Weather-resistant (WR): every 15A or 20A, 125V/250V nonlocking receptacle installed outdoors -whether damp or wet- must be listed weather-resistant type (marked WR), per NEC 406.9(A) for damp and NEC 406.9(B)(1) for wet; the WR marking is on the receptacle itself, a requirement separate from the cover. 4) Cover when NOT in use (damp location): NEC 406.9(A) requires the cover to be weatherproof only when the receptacle is closed (attachment plug not inserted); a standard flip-lid cover is normally sufficient if the area is protected from direct rain. 5) While-in-use / extra-duty cover (wet location): NEC 406.9(B)(1) requires a cover that is weatherproof even with the attachment plug inserted ('while-in-use'), and that outlet box hood must be listed and identified as 'extra duty'; this typically applies to any outdoor receptacle with no rain protection at all (for example, on an exterior wall with no eave). 6) Residential application: for a single-family dwelling, most outdoor receptacles (patio, front of house, yard, open carport) are treated as wet locations unless clearly protected by a roof/eave with sufficient side coverage, so in practice an extra-duty while-in-use cover is installed as standard, along with a WR receptacle and GFCI protection. This is a preliminary internal guide in plain language (not the official NEC text): verify the exact edition adopted by the AHJ before installing.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar si la ubicacion es damp (cubierta) o wet (expuesta directamente a lluvia/agua)",
      "Verificar proteccion GFCI en el circuito (NEC 210.8(A)(3) / 210.8(F))",
      "Verificar que el receptaculo especificado sea tipo weather-resistant (WR) listado (NEC 406.9(A)/(B))",
      "Confirmar cubierta weatherproof estandar (solo cuando esta cerrada) para lugares humedos cubiertos",
      "Confirmar cubierta while-in-use listada como extra-duty para lugares mojados expuestos",
      "En aplicacion residencial, tratar el receptaculo como lugar mojado salvo proteccion clara contra lluvia directa"
    ],
    checklistEn: [
      "Confirm whether the location is damp (covered) or wet (directly exposed to rain/water)",
      "Verify GFCI protection on the circuit (NEC 210.8(A)(3) / 210.8(F))",
      "Verify the specified receptacle is a listed weather-resistant (WR) type (NEC 406.9(A)/(B))",
      "Confirm a standard weatherproof cover (weatherproof only while closed) for covered damp locations",
      "Confirm an extra-duty listed while-in-use cover for exposed wet locations",
      "For residential applications, treat the receptacle as a wet location unless clearly protected from direct rain"
    ],
    missingQuestionsEs: [
      "Ubicacion exacta (cubierta bajo techo/alero vs expuesta directamente a la lluvia)",
      "Si el receptaculo estara en uso con el enchufe conectado de forma permanente (requiere cubierta while-in-use)",
      "Amperaje y voltaje del receptaculo, y si el proyecto es una vivienda (dwelling unit) u otra ocupacion"
    ],
    missingQuestionsEn: [
      "Exact location (covered under a roof/eave vs directly exposed to rain)",
      "Whether the receptacle will be used with the attachment plug inserted permanently (requires a while-in-use cover)",
      "Receptacle amperage and voltage, and whether the project is a dwelling unit or another occupancy"
    ],
    recommendationEs:
      "Confirmar la clasificacion exacta de la ubicacion (damp o wet), la proteccion GFCI, el listado weather-resistant del receptaculo y el tipo de cubierta (weatherproof estandar o while-in-use extra-duty) antes de instalar.",
    recommendationEn:
      "Confirm the exact classification of the location (damp or wet), GFCI protection, the receptacle's weather-resistant listing, and the cover type (standard weatherproof or extra-duty while-in-use) before installing.",
    warningEs:
      "Guia preliminar interna basada en NEC 2023 y practica general; no reemplaza el texto oficial completo de NEC 406.9 ni 210.8. Verificar el articulo oficial, la edicion exacta adoptada por el AHJ y la aprobacion del Master Electrician antes de instalar.",
    warningEn:
      "Preliminary internal guide based on NEC 2023 and general practice; it does not replace the full official text of NEC 406.9 or 210.8. Verify the official article, the exact edition adopted by the AHJ, and Master Electrician approval before installing."
  },
  {
    id: "kb-mc-cable",
    matchCategory: "mc_cable",
    category: "MC Cable (cable metal-clad, NEC Article 330)",
    keywords: [
      "mc cable",
      "cable mc",
      "metal clad cable",
      "metal-clad cable",
      "cable metalico armado",
      "armored cable",
      "cable armado",
      "conectores mc",
      "mc connector",
      "mc connectors",
      "soportar cable mc",
      "supporting mc cable"
    ],
    codeReference: "NEC Article 330 (Metal-Clad Cable, Type MC)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "El cable MC (metal-clad, con armadura metalica flexible) se instala segun NEC Article 330. Debe asegurarse (soportarse) a no mas de 6 pies de distancia entre soportes, y dentro de 12 pulgadas de cada caja, gabinete o conector, con excepciones para tramos 'fished' dentro de paredes terminadas donde no es practico soportarlo asi (NEC 330.30). Los conectores deben estar listados especificamente para MC cable (NEC 330.40); no se debe usar un conector generico o de otro metodo de cableado. El radio de curvatura minimo depende del fabricante y del diametro del cable, y debe respetarse para no danar el aislamiento interno. El MC cable estandar normalmente NO esta listado para enterrado directo ni para lugares humedos o corrosivos, a menos que sea un tipo especial listado para esa condicion (por ejemplo con cubierta resistente a la corrosion). La puesta a tierra del equipo puede lograrse mediante un conductor de tierra interno dedicado, o mediante la armadura metalica misma si el cable especifico esta listado para ese proposito; esto debe confirmarse contra el listado del producto, no asumirse.",
    shortAnswerEn:
      "MC (metal-clad) cable, with a flexible metal armor, is installed per NEC Article 330. It must be supported at intervals not exceeding 6 feet, and within 12 inches of every box, cabinet, or connector, with exceptions for fished runs in finished walls where that support pattern isn't practical (NEC 330.30). Connectors must be listed specifically for MC cable (NEC 330.40); a generic connector or one listed for a different wiring method must not be used. The minimum bend radius depends on the manufacturer and cable diameter and must be respected to avoid damaging the internal insulation. Standard MC cable is normally NOT listed for direct burial or for wet/corrosive locations unless it is a special type listed for that condition (for example, with a corrosion-resistant jacket). Equipment grounding can be achieved through a dedicated internal grounding conductor, or through the metal armor itself if the specific cable is listed for that purpose; this must be confirmed against the product's listing, not assumed.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar soportes cada 6 pies maximo y dentro de 12 pulgadas de cada caja/conector (con excepciones para tramos fished)",
      "Usar conectores listados especificamente para MC cable",
      "Verificar radio de curvatura minimo del fabricante",
      "Confirmar si la ubicacion es humeda, corrosiva o enterrada y si el MC cable especificado esta listado para esa condicion",
      "Confirmar el metodo de puesta a tierra de equipo (conductor interno dedicado o armadura listada para ese uso)"
    ],
    checklistEn: [
      "Confirm supports every 6 feet maximum and within 12 inches of every box/connector (with exceptions for fished runs)",
      "Use connectors listed specifically for MC cable",
      "Verify the manufacturer's minimum bend radius",
      "Confirm whether the location is wet, corrosive, or underground and whether the specified MC cable is listed for that condition",
      "Confirm the equipment grounding method (dedicated internal conductor or armor listed for that use)"
    ],
    missingQuestionsEs: [
      "Ubicacion exacta de la instalacion (seca, humeda, corrosiva, enterrada)",
      "Tipo especifico de MC cable especificado (estandar o listado especial)",
      "Si el tramo es fished dentro de una pared terminada"
    ],
    missingQuestionsEn: [
      "Exact installation location (dry, wet, corrosive, underground)",
      "Specific MC cable type specified (standard or special listing)",
      "Whether the run is fished inside a finished wall"
    ],
    recommendationEs:
      "Confirmar el tipo especifico de MC cable y su listado para la ubicacion exacta antes de instalar; usar unicamente conectores listados para MC cable.",
    recommendationEn:
      "Confirm the specific MC cable type and its listing for the exact location before installing; use only connectors listed for MC cable.",
    warningEs:
      "Guia general interna basada en NEC Article 330; verificar el articulo oficial y el listado especifico del producto antes de instalar, especialmente en ubicaciones humedas, corrosivas o enterradas.",
    warningEn:
      "General internal guide based on NEC Article 330; verify the official article and the product's specific listing before installing, especially in wet, corrosive, or underground locations."
  },

  // ===========================================================================
  // Sprint 2 - PARTE 1: 6 entradas nuevas (receptaculos generales, cocinas,
  // banos, panel working space, servicio residencial, HVAC). Todas usan
  // referencias NEC de alta confianza/muy conocidas (mismo nivel de certeza
  // que el resto de este archivo); cualquier numero/regla que depende de la
  // placa del equipo, de la edicion adoptada por el AHJ, o que varia entre
  // ediciones del NEC (ej. reglas de isla/peninsula en cocina, distancia
  // exacta a tina/ducha en bano, el porcentaje exacto de la formula MOCP) se
  // deja explicitamente marcado como "pendiente de verificacion puntual" en
  // vez de asumirse, en vez de inventarse un valor.
  // ===========================================================================

  {
    id: "kb-receptacle-spacing-tr",
    matchCategory: "receptacles",
    category: "Receptaculos generales: espaciamiento y tamper-resistant (NEC 210.52(A) / 406.12)",
    keywords: [
      "espaciamiento de receptaculos",
      "receptaculos por pared",
      "regla de 6 pies",
      "regla de 12 pies",
      "cuantos receptaculos",
      "distancia entre receptaculos",
      "receptaculo tamper resistant",
      "receptaculo tamper-resistant",
      "tamper-resistant",
      "tamper resistant",
      "a prueba de manipulacion",
      "receptaculo tr",
      "receptacle spacing",
      "spacing between receptacles",
      "maximum spacing between receptacles",
      "6 foot rule",
      "12 foot rule",
      "how many receptacles",
      "tamper-resistant receptacle",
      "tamper-resistant receptacles",
      "tr receptacle",
      "dwelling unit receptacles"
    ],
    codeReference: "NEC 210.52(A) (receptaculos en areas habitables de vivienda) y NEC 406.12 (receptaculos tamper-resistant en vivienda)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "En las areas habitables de una vivienda (salas, dormitorios, comedores, pasillos, etc.), NEC 210.52(A) exige colocar receptaculos de pared de modo que ningun punto a lo largo de la linea de pared quede a mas de 6 pies de un receptaculo, y que todo espacio de pared de 2 pies o mas de ancho tenga al menos uno; en la practica esto se conoce como la regla de los 6/12 pies (dos receptaculos consecutivos nunca separados por mas de 12 pies). Ademas, NEC 406.12 exige que los receptaculos de 15A y 20A, 125V en vivienda sean del tipo tamper-resistant (TR, con obturadores internos que bloquean el ingreso de objetos en un solo contacto), independientemente de la ubicacion dentro de la vivienda.",
    explanationEs:
      "La medida se toma a lo largo del piso, siguiendo el contorno de la pared (no en linea recta cruzando la habitacion), y aplica a las areas habitables listadas en 210.52(A); no aplica igual a cocina/countertop (210.52(C)) ni a bano (210.52(D)), que tienen su propia regla. Espacios de pared separados por una puerta, chimenea u otro elemento fijo de mas de 2 pies se consideran espacios de pared distintos, cada uno con su propio requisito. Los receptaculos tamper-resistant son obligatorios en las ubicaciones de vivienda cubiertas por el articulo, con excepciones puntuales (ej. cierto equipo fijo en espacio dedicado) que no se detallan aqui y deben verificarse contra el texto oficial.",
    shortAnswerEn:
      "In a dwelling's habitable areas (living rooms, bedrooms, dining rooms, hallways, etc.), NEC 210.52(A) requires wall receptacles to be placed so no point along the wall's floor line is more than 6 feet from a receptacle, and every wall space 2 feet or wider has at least one; in practice this is known as the 6/12-foot rule (no two consecutive receptacles more than 12 feet apart). In addition, NEC 406.12 requires 15A and 20A, 125V receptacles in dwellings to be tamper-resistant (TR, with internal shutters that block objects from entering a single contact), regardless of location within the dwelling.",
    explanationEn:
      "The measurement is taken along the floor, following the wall's contour (not in a straight line across the room), and applies to the habitable areas listed in 210.52(A); it does not apply the same way to kitchen/countertop (210.52(C)) or bathroom (210.52(D)), which have their own rule. Wall spaces separated by a doorway, fireplace, or other fixed element more than 2 feet wide are treated as separate wall spaces, each with its own requirement. Tamper-resistant receptacles are required in the dwelling locations covered by the article, with specific exceptions (e.g., certain fixed equipment in dedicated space) not detailed here that must be verified against the official text.",
    riskLevel: "bajo",
    checklistEs: [
      "Medir la distancia a lo largo de la linea de pared, no en diagonal",
      "Confirmar que ningun punto de pared quede a mas de 6 pies de un receptaculo",
      "Confirmar que espacios de pared de 2 pies o mas tengan al menos un receptaculo",
      "Verificar que los receptaculos de 15A/20A 125V sean listados tamper-resistant"
    ],
    checklistEn: [
      "Measure distance along the wall's floor line, not diagonally",
      "Confirm no point along the wall is more than 6 feet from a receptacle",
      "Confirm wall spaces 2 feet or wider have at least one receptacle",
      "Verify 15A/20A 125V receptacles are listed tamper-resistant"
    ],
    commonMistakesEs: [
      "Medir la distancia en linea recta cruzando la habitacion en vez de a lo largo del contorno de la pared",
      "Omitir receptaculos en espacios de pared de 2 pies o mas solo porque parecen pequenos",
      "Instalar receptaculos estandar (no tamper-resistant) asumiendo que TR solo aplica donde hay ninos"
    ],
    commonMistakesEn: [
      "Measuring distance in a straight line across the room instead of along the wall's floor line",
      "Skipping receptacles in wall spaces 2 feet or wider because they look small",
      "Installing standard (non tamper-resistant) receptacles assuming TR only applies where children live"
    ],
    missingQuestionsEs: ["Uso especifico de la habitacion (living area vs cocina/bano, que tienen reglas propias)", "Edicion del NEC adoptada por el AHJ"],
    missingQuestionsEn: ["Specific room use (living area vs kitchen/bathroom, which have their own rules)", "NEC edition adopted by the AHJ"],
    recommendationEs:
      "Verificar el espaciamiento medido a lo largo de la pared y confirmar que todos los receptaculos de vivienda sean tamper-resistant antes de cerrar la instalacion; para cocina y bano usar las reglas especificas de esas areas, no esta regla general.",
    recommendationEn:
      "Verify spacing measured along the wall and confirm all dwelling receptacles are tamper-resistant before closing out the installation; for kitchens and bathrooms use their own specific rules, not this general one.",
    warningEs:
      "Guia preliminar interna basada en NEC 210.52(A) y 406.12; existen excepciones puntuales no cubiertas aqui (pendientes de verificacion puntual). Verificar el texto oficial, la edicion adoptada por el AHJ y la aprobacion del Master Electrician antes de instalar.",
    warningEn:
      "Preliminary internal guide based on NEC 210.52(A) and 406.12; specific exceptions exist that are not covered here (pending specific verification). Verify the official text, the edition adopted by the AHJ, and Master Electrician approval before installing."
  },
  {
    id: "kb-kitchen-receptacles",
    matchCategory: "receptacles",
    category: "Cocinas: circuitos de pequenos electrodomesticos y receptaculos de countertop (NEC 210.11(C)(1) / 210.52(C))",
    keywords: [
      "circuitos de countertop",
      "circuito de countertop",
      "pequenos electrodomesticos",
      "electrodomesticos pequenos",
      "circuito dedicado cocina",
      "receptaculos de cocina",
      "espaciamiento countertop",
      "distancia countertop",
      "cuantos circuitos cocina",
      "sobre el countertop",
      "countertop",
      "cocina residencial",
      "countertop circuits",
      "small appliance circuit",
      "small appliance circuits",
      "kitchen receptacles",
      "countertop receptacle spacing",
      "dedicated kitchen circuit",
      "countertop spacing"
    ],
    codeReference: "NEC 210.11(C)(1) (circuitos de pequenos electrodomesticos) y NEC 210.52(C) (receptaculos de countertop en cocina)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Una cocina residencial requiere al menos dos circuitos ramales de 20A dedicados a pequenos electrodomesticos (small-appliance branch circuits) que alimenten los receptaculos de countertop y del area de comedor/desayunador asociada, segun NEC 210.11(C)(1); estos circuitos no deben alimentar iluminacion fija ni otros receptaculos fuera de esas areas. Para el espaciamiento, NEC 210.52(C) exige que ningun punto a lo largo de la linea de countertop quede a mas de 24 pulgadas de un receptaculo, y que todo espacio de countertop de 12 pulgadas o mas de ancho tenga uno (en la practica, un maximo de 4 pies entre receptaculos).",
    explanationEs:
      "Los dos circuitos de 20A son un minimo: cocinas grandes o con mucho countertop pueden requerir mas para cumplir el espaciamiento. Islas y peninsulas de cocina tienen reglas de receptaculos que han cambiado entre ediciones del NEC (la cantidad y el metodo de montaje permitido varian): esto queda pendiente de verificacion puntual contra la edicion exacta adoptada por el AHJ, no se asume aqui un requisito especifico de isla/peninsula. Los receptaculos de countertop en cocina tambien requieren proteccion GFCI (ver la entrada de GFCI) y, en vivienda, deben ser tamper-resistant (NEC 406.12).",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar al menos 2 circuitos de 20A dedicados a pequenos electrodomesticos",
      "Verificar que esos circuitos no alimenten luminarias fijas ni otros receptaculos",
      "Medir espaciamiento de countertop: maximo 24 pulgadas a cualquier punto, receptaculo en espacios de 12+ pulgadas",
      "Confirmar GFCI y tamper-resistant en los receptaculos de countertop",
      "Verificar reglas de isla/peninsula contra la edicion exacta adoptada por el AHJ (pendiente de revision puntual)"
    ],
    checklistEn: [
      "Confirm at least 2 dedicated 20A small-appliance circuits",
      "Verify those circuits do not feed fixed lighting or other receptacles",
      "Measure countertop spacing: max 24 inches to any point, receptacle for spaces 12+ inches wide",
      "Confirm GFCI and tamper-resistant protection on countertop receptacles",
      "Verify island/peninsula rules against the exact edition adopted by the AHJ (pending specific verification)"
    ],
    commonMistakesEs: [
      "Alimentar luminarias fijas o el refrigerador desde el mismo circuito de pequenos electrodomesticos",
      "Asumir que un solo circuito de 20A basta sin verificar el espaciamiento de 24 pulgadas",
      "Omitir GFCI o tamper-resistant en los receptaculos de countertop"
    ],
    commonMistakesEn: [
      "Feeding fixed lighting or the refrigerator from the same small-appliance circuit",
      "Assuming a single 20A circuit covers the kitchen without checking the 24-inch spacing rule",
      "Omitting GFCI or tamper-resistant protection on countertop receptacles"
    ],
    shortAnswerEn:
      "A residential kitchen requires at least two dedicated 20A small-appliance branch circuits feeding the countertop receptacles and the associated dining/breakfast area receptacles, per NEC 210.11(C)(1); these circuits must not feed fixed lighting or other receptacles outside those areas. For spacing, NEC 210.52(C) requires that no point along the countertop line be more than 24 inches from a receptacle, and that any countertop space 12 inches or wider have one (in practice, a maximum of 4 feet between receptacles).",
    explanationEn:
      "The two 20A circuits are a minimum: larger kitchens or kitchens with more countertop may need additional circuits to meet the spacing rule. Island and peninsula receptacle rules have changed across NEC editions (the required count and permitted mounting method vary): this is left pending specific verification against the exact edition adopted by the AHJ, and no specific island/peninsula requirement is assumed here. Countertop receptacles in a kitchen also require GFCI protection (see the GFCI entry) and, in a dwelling, must be tamper-resistant (NEC 406.12).",
    missingQuestionsEs: ["Tamano y layout exacto del countertop (incluye isla o peninsula)", "Edicion del NEC adoptada por el AHJ"],
    missingQuestionsEn: ["Exact countertop size and layout (includes island or peninsula)", "NEC edition adopted by the AHJ"],
    recommendationEs: "Confirmar el layout exacto del countertop (incluyendo islas/peninsulas) contra la edicion adoptada por el AHJ antes de fijar cantidad final de receptaculos y circuitos.",
    recommendationEn: "Confirm the exact countertop layout (including islands/peninsulas) against the edition adopted by the AHJ before finalizing the receptacle and circuit count.",
    warningEs:
      "Guia preliminar interna basada en NEC 210.11(C)(1) y 210.52(C); las reglas de isla/peninsula varian por edicion y quedan pendientes de verificacion puntual. Verificar el texto oficial, la edicion adoptada por el AHJ y la aprobacion del Master Electrician antes de instalar.",
    warningEn:
      "Preliminary internal guide based on NEC 210.11(C)(1) and 210.52(C); island/peninsula rules vary by edition and are left pending specific verification. Verify the official text, the edition adopted by the AHJ, and Master Electrician approval before installing."
  },
  {
    id: "kb-bathroom-receptacles",
    matchCategory: "receptacles",
    category: "Banos: circuito de 20A, receptaculos y GFCI (NEC 210.11(C)(3) / 210.8(A)(1) / 210.52(D))",
    keywords: [
      "circuito dedicado de 20a",
      "circuito de 20a para bano",
      "receptaculo del bano",
      "receptaculo de bano",
      "bano",
      "lavamanos",
      "cerca del lavamanos",
      "cerca de la tina",
      "cerca de la ducha",
      "tomacorriente",
      "dedicated 20a circuit",
      "20a circuit for bathroom",
      "bathroom receptacle",
      "bathroom outlet",
      "bathroom",
      "near the sink",
      "near the tub",
      "near the shower",
      "basin"
    ],
    codeReference: "NEC 210.11(C)(3) (circuito dedicado de 20A para bano), NEC 210.8(A)(1) (GFCI en banos) y NEC 210.52(D) (receptaculo cerca del lavamanos)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Cada bano de una vivienda requiere al menos un receptaculo, ubicado a no mas de 3 pies del borde exterior de cada lavamanos, segun NEC 210.52(D). Ese receptaculo debe tener proteccion GFCI (NEC 210.8(A)(1)). NEC 210.11(C)(3) exige al menos un circuito ramal de 20A dedicado a los receptaculos de bano: ese circuito puede alimentar unicamente receptaculos de bano (de uno o mas banos), o, si el circuito de 20A sirve a un solo bano, puede tambien alimentar otro equipo de ese mismo bano (luminarias, extractor); esta segunda opcion tiene condiciones especificas que deben verificarse contra el texto oficial antes de asumirla.",
    explanationEs:
      "El receptaculo no puede ubicarse dentro de la tina o ducha, y debe mantenerse fuera de las zonas de contacto directo con el agua; las distancias exactas de separacion respecto a la tina/ducha dependen de la edicion adoptada por el AHJ y quedan pendientes de verificacion puntual, no se asume aqui una distancia especifica. En vivienda, el receptaculo del bano tambien debe ser tamper-resistant (NEC 406.12). 'Tomacorriente' es el sinonimo mas comun de 'receptaculo' usado en espanol de Texas/Houston para este mismo dispositivo.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar al menos un receptaculo a no mas de 3 pies del lavamanos",
      "Verificar proteccion GFCI en el receptaculo del bano",
      "Confirmar circuito dedicado de 20A y si alimenta solo receptaculos o tambien otro equipo del mismo bano",
      "Verificar distancia a tina/ducha contra el texto oficial y el AHJ (pendiente de revision puntual)",
      "Confirmar que el receptaculo sea tamper-resistant"
    ],
    checklistEn: [
      "Confirm at least one receptacle within 3 feet of the basin",
      "Verify GFCI protection on the bathroom receptacle",
      "Confirm a dedicated 20A circuit and whether it feeds only receptacles or also other equipment in the same bathroom",
      "Verify tub/shower clearance against the official text and the AHJ (pending specific verification)",
      "Confirm the receptacle is tamper-resistant"
    ],
    commonMistakesEs: [
      "Instalar el receptaculo del bano en el mismo circuito que otros banos o areas sin dedicarlo correctamente",
      "Omitir GFCI en el receptaculo del bano",
      "Ubicar el receptaculo dentro o demasiado cerca de la tina/ducha sin verificar la distancia exacta exigida por el AHJ"
    ],
    commonMistakesEn: [
      "Wiring the bathroom receptacle on the same circuit as other bathrooms or areas without properly dedicating it",
      "Omitting GFCI protection on the bathroom receptacle",
      "Locating the receptacle inside or too close to the tub/shower without verifying the exact AHJ-required clearance"
    ],
    shortAnswerEn:
      "Every bathroom in a dwelling requires at least one receptacle, located within 3 feet of the outside edge of each basin, per NEC 210.52(D). That receptacle must have GFCI protection (NEC 210.8(A)(1)). NEC 210.11(C)(3) requires at least one dedicated 20A branch circuit for bathroom receptacles: that circuit can supply only bathroom receptacles (in one or more bathrooms), or, if the 20A circuit serves a single bathroom, it may also supply other equipment in that same bathroom (lighting, exhaust fan); this second option has specific conditions that must be verified against the official text before assuming it applies.",
    explanationEn:
      "The receptacle cannot be located inside the tub or shower space, and must stay clear of direct water-contact zones; the exact separation distances from the tub/shower depend on the edition adopted by the AHJ and are left pending specific verification here, no specific distance is assumed. In a dwelling, the bathroom receptacle must also be tamper-resistant (NEC 406.12). 'Tomacorriente' is the most common Spanish synonym for 'receptaculo' used in Texas/Houston Spanish for this same device.",
    missingQuestionsEs: ["Layout exacto del bano (ubicacion de lavamanos, tina, ducha)", "Si el circuito de 20A sirve un solo bano o varios", "Edicion del NEC adoptada por el AHJ"],
    missingQuestionsEn: ["Exact bathroom layout (sink, tub, shower locations)", "Whether the 20A circuit serves one bathroom or several", "NEC edition adopted by the AHJ"],
    recommendationEs: "Confirmar el layout exacto del bano y la edicion adoptada por el AHJ antes de fijar la ubicacion final del receptaculo y el alcance del circuito dedicado.",
    recommendationEn: "Confirm the exact bathroom layout and the edition adopted by the AHJ before finalizing the receptacle location and the dedicated circuit's scope.",
    warningEs:
      "Guia preliminar interna basada en NEC 210.11(C)(3), 210.8(A)(1) y 210.52(D); la distancia exacta respecto a tina/ducha varia por edicion y queda pendiente de verificacion puntual. Verificar el texto oficial, la edicion adoptada por el AHJ y la aprobacion del Master Electrician antes de instalar.",
    warningEn:
      "Preliminary internal guide based on NEC 210.11(C)(3), 210.8(A)(1), and 210.52(D); the exact tub/shower clearance varies by edition and is left pending specific verification. Verify the official text, the edition adopted by the AHJ, and Master Electrician approval before installing."
  },
  {
    id: "kb-panel-working-space",
    matchCategory: "panels",
    category: "Espacio de trabajo frente a paneles electricos (NEC 110.26)",
    keywords: [
      "espacio de trabajo",
      "espacio de trabajo frente al panel",
      "clearance del panel",
      "ancho de trabajo",
      "profundidad de trabajo",
      "altura de trabajo",
      "obstrucciones frente al panel",
      "acceso al panel",
      "110.26",
      "espacio dedicado sobre el panel",
      "working space",
      "working space in front of the panel",
      "clearance in front of the panel",
      "clearance is required in front of",
      "in front of an electrical panel",
      "panel clearance",
      "width of working space",
      "depth of working space",
      "height of working space",
      "obstructions in front of panel",
      "panel access",
      "dedicated space above the panel"
    ],
    codeReference: "NEC 110.26(A) (espacio de trabajo: profundidad, ancho y altura) y NEC 110.26(B) (espacio dedicado a equipo)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "NEC 110.26 exige un espacio de trabajo despejado frente a paneles y equipo electrico para permitir operacion y mantenimiento seguros. Para el caso residencial/comercial tipico (0-150V a tierra, condicion 1 o 2), la profundidad minima de referencia es 3 pies (36 pulgadas); el ancho minimo es 30 pulgadas o el ancho del equipo, lo que sea mayor; y la altura minima es 6.5 pies (78 pulgadas) o la altura del equipo. La profundidad exacta varia segun el voltaje a tierra y la condicion (1, 2 o 3) de la Table 110.26(A)(1): este valor de 3 pies es el mas comun para equipo residencial de baja tension, no un numero universal para todos los casos.",
    explanationEs:
      "El espacio de trabajo no puede usarse como area de almacenamiento, y debe estar libre de obstrucciones fijas (tuberia, ductos, otro equipo) dentro de esa zona. Ademas, NEC 110.26(B) exige un espacio dedicado sobre el panel (tipicamente hasta el techo estructural o 6 pies de altura, lo que sea menor) libre de tuberia de agua/gas o ductos de HVAC ajenos, salvo protecciones especificas permitidas por el codigo. Requisitos adicionales de acceso/salidas aplican a equipo de mayor capacidad (tipicamente sobre 1200A), que no es el caso residencial tipico y queda fuera del alcance de esta guia.",
    riskLevel: "alto",
    checklistEs: [
      "Confirmar profundidad de trabajo segun voltaje a tierra y condicion (1/2/3) de la tabla oficial",
      "Confirmar ancho minimo (30 pulgadas o ancho del equipo)",
      "Confirmar altura minima (6.5 pies o altura del equipo)",
      "Verificar que el espacio de trabajo este libre de almacenamiento y obstrucciones",
      "Verificar el espacio dedicado sobre el panel libre de tuberia/ductos ajenos"
    ],
    checklistEn: [
      "Confirm working depth per the official table's voltage-to-ground and condition (1/2/3)",
      "Confirm minimum width (30 inches or equipment width)",
      "Confirm minimum height (6.5 feet or equipment height)",
      "Verify the working space is free of storage and obstructions",
      "Verify the dedicated space above the panel is free of foreign piping/ductwork"
    ],
    commonMistakesEs: [
      "Usar el espacio frente al panel para almacenar cajas, herramientas o material",
      "Instalar estantes, tuberia o ductos dentro del espacio de trabajo o del espacio dedicado sobre el panel",
      "Asumir que 3 pies de profundidad aplica a todos los voltajes sin verificar la tabla segun condicion 1/2/3"
    ],
    commonMistakesEn: [
      "Using the space in front of the panel to store boxes, tools, or material",
      "Installing shelving, piping, or ductwork inside the working space or the dedicated space above the panel",
      "Assuming 3 feet of depth applies to all voltages without checking the table for condition 1/2/3"
    ],
    shortAnswerEn:
      "NEC 110.26 requires a clear working space in front of panels and electrical equipment to allow safe operation and maintenance. For the typical residential/commercial case (0-150V to ground, condition 1 or 2), the reference minimum depth is 3 feet (36 inches); the minimum width is 30 inches or the width of the equipment, whichever is greater; and the minimum height is 6.5 feet (78 inches) or the height of the equipment. The exact depth varies by voltage to ground and condition (1, 2, or 3) per Table 110.26(A)(1): this 3-foot figure is the most common for typical low-voltage residential equipment, not a universal number for every case.",
    explanationEn:
      "The working space cannot be used as storage area, and must be free of fixed obstructions (piping, ductwork, other equipment) within that zone. In addition, NEC 110.26(B) requires a dedicated space above the panel (typically up to the structural ceiling or 6 feet high, whichever is less) free of foreign water/gas piping or HVAC ductwork, except for specific protections the code permits. Additional access/exit requirements apply to larger equipment (typically above 1200A), which is not the typical residential case and is outside the scope of this guide.",
    missingQuestionsEs: ["Voltaje a tierra y condicion (1, 2 o 3) del equipo", "Amperaje del equipo (para requisitos de acceso en equipo grande)"],
    missingQuestionsEn: ["Voltage to ground and condition (1, 2, or 3) of the equipment", "Equipment amperage (for access requirements on larger equipment)"],
    recommendationEs: "Confirmar la profundidad exacta contra la Table 110.26(A)(1) segun voltaje/condicion antes de aprobar el espacio; escalar al Master Electrician si hay obstrucciones existentes.",
    recommendationEn: "Confirm the exact depth against Table 110.26(A)(1) based on voltage/condition before approving the space; escalate to the Master Electrician if existing obstructions are present.",
    warningEs:
      "Guia preliminar interna basada en NEC 110.26; los valores de 3 pies/30 pulgadas/6.5 pies son la referencia mas comun para equipo residencial de baja tension, no un valor universal. Verificar la tabla oficial, la edicion adoptada por el AHJ y la aprobacion del Master Electrician antes de aprobar el espacio.",
    warningEn:
      "Preliminary internal guide based on NEC 110.26; the 3-foot/30-inch/6.5-foot figures are the most common reference for low-voltage residential equipment, not a universal value. Verify the official table, the edition adopted by the AHJ, and Master Electrician approval before approving the space."
  },
  {
    id: "kb-residential-service",
    matchCategory: "services",
    category: "Servicio residencial: tamano minimo y desconectadores (NEC 230.79(C) / 230.71)",
    keywords: [
      "amperaje minimo de servicio",
      "tamano minimo de servicio",
      "servicio residencial",
      "disconnect de servicio principal",
      "desconectador principal",
      "desconectadores de servicio",
      "cuantos disconnects",
      "vivienda unifamiliar",
      "100 amperios",
      "200 amperios",
      "minimum service size",
      "minimum service amperage",
      "residential service",
      "main service disconnect",
      "service disconnect",
      "how many service disconnects",
      "one-family dwelling",
      "100 amp service",
      "200 amp service"
    ],
    // Referencia ya verificada en este proyecto: coincide exactamente con la
    // entrada semilla real de public.knowledge_entries (ver
    // supabase/knowledge_entries_upgrade.sql, categoria
    // "residential_service_panel"), replicada aqui como entrada local para
    // que la respuesta este disponible aunque Supabase no este configurado.
    codeReference: "NEC 230.79(C) (tamano minimo de servicio para vivienda unifamiliar), NEC 230.71 (numero maximo de desconectadores de servicio) y NEC Article 220 (calculo de carga final)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "Para una vivienda unifamiliar, el minimo tipico de servicio o desconectador principal es 100 amperios, 3 hilos, conforme a NEC 230.79(C) (esta es la misma referencia ya verificada en la base de conocimiento de este proyecto). El tamano final del servicio no se define solo por esa regla fija: debe confirmarse mediante calculo de carga conforme a NEC Article 220, los requisitos de la compania electrica, las condiciones existentes del inmueble y la aprobacion del AHJ local. Ademas, NEC 230.71(A) permite hasta 6 desconectadores de servicio agrupados en una ubicacion (en vez de un unico desconectador principal), cada uno marcado permanentemente para indicar su uso.",
    explanationEs:
      "En viviendas modernas, remodelaciones grandes, EV chargers, HVAC electrico o cargas nuevas importantes, 200A puede ser recomendable o requerido segun el caso; esto se determina con el calculo de carga, no con una regla generica. 'Desconectador de servicio' (service disconnect) es el medio para cortar toda la energia entrante al inmueble; puede ser un unico interruptor principal o, como permite 230.71(A), hasta 6 interruptores o fusibles agrupados que en conjunto cumplen esa funcion. Cada desconectador debe estar marcado para identificar la carga que controla.",
    riskLevel: "medio",
    checklistEs: [
      "Confirmar calculo de carga actualizado segun NEC Article 220",
      "Verificar requisitos de la compania electrica",
      "Confirmar cantidad de desconectadores de servicio (maximo 6 agrupados, NEC 230.71(A))",
      "Verificar marcado permanente de cada desconectador",
      "Confirmar aprobacion del AHJ local"
    ],
    checklistEn: [
      "Confirm an updated load calculation per NEC Article 220",
      "Verify utility requirements",
      "Confirm the number of service disconnects (maximum 6 grouped, NEC 230.71(A))",
      "Verify permanent marking on each disconnect",
      "Confirm local AHJ approval"
    ],
    commonMistakesEs: [
      "Asumir que 100A siempre es suficiente sin hacer el calculo de carga segun Article 220",
      "Confundir 'desconectador de servicio' con un breaker cualquiera del panel de distribucion",
      "Instalar mas de 6 desconectadores de servicio agrupados sin verificar el limite de NEC 230.71(A)"
    ],
    commonMistakesEn: [
      "Assuming 100A is always sufficient without performing the Article 220 load calculation",
      "Confusing a service disconnect with any breaker in the distribution panel",
      "Installing more than 6 grouped service disconnects without checking the NEC 230.71(A) limit"
    ],
    shortAnswerEn:
      "For a one-family dwelling, the typical minimum service or main disconnect rating is 100 amps, 3-wire, under NEC 230.79(C) (this is the same reference already verified in this project's knowledge base). The final service size is not defined by that fixed rule alone: it must be confirmed with a load calculation per NEC Article 220, the utility's requirements, existing site conditions, and local AHJ approval. In addition, NEC 230.71(A) allows up to 6 service disconnects grouped at one location (instead of a single main disconnect), each permanently marked to indicate its use.",
    explanationEn:
      "In modern homes, major remodels, EV chargers, electric HVAC, or significant new loads, 200A may be recommended or required depending on the case; this is determined by the load calculation, not by a generic rule. A service disconnect is the means to cut all incoming power to the building; it can be a single main breaker or, as 230.71(A) permits, up to 6 grouped breakers or fuses that together perform that function. Each disconnect must be marked to identify the load it controls.",
    missingQuestionsEs: ["Calculo de carga actualizado disponible", "Cargas nuevas planificadas (EV charger, HVAC electrico, remodelacion)", "Requisitos especificos de la compania electrica"],
    missingQuestionsEn: ["Updated load calculation available", "Planned new loads (EV charger, electric HVAC, remodel)", "Specific utility requirements"],
    recommendationEs: "No fijar el tamano final del servicio sin un calculo de carga actualizado; escalar al Master Electrician para confirmar contra Article 220, la utility y el AHJ.",
    recommendationEn: "Do not finalize the service size without an updated load calculation; escalate to the Master Electrician to confirm against Article 220, the utility, and the AHJ.",
    warningEs:
      "Guia preliminar interna basada en NEC 230.79(C) y 230.71(A); no reemplaza el calculo de carga oficial ni la aprobacion del AHJ. Verificar la edicion exacta adoptada por el AHJ y la aprobacion del Master Electrician antes de fijar el tamano final del servicio.",
    warningEn:
      "Preliminary internal guide based on NEC 230.79(C) and 230.71(A); it does not replace the official load calculation or AHJ approval. Verify the exact edition adopted by the AHJ and Master Electrician approval before finalizing the service size."
  },
  {
    id: "kb-hvac-electrical",
    matchCategory: "installation_methods",
    category: "HVAC: disconnect, MCA, MOCP y calibre de conductor (NEC Article 440)",
    keywords: [
      "breaker para aire acondicionado",
      "unidad de aire acondicionado",
      "aire acondicionado",
      "disconnect de hvac",
      "disconnect del condensador",
      "calibre del conductor",
      "compresor de hvac",
      "mca",
      "mocp",
      "placa del equipo hvac",
      "carga del compresor",
      "article 440",
      "articulo 440",
      "hvac breaker",
      "air conditioning breaker",
      "hvac disconnect",
      "hvac condenser unit",
      "condenser unit",
      "conductor size for compressor",
      "compressor load",
      "equipment nameplate"
    ],
    codeReference: "NEC Article 440 (Air-Conditioning and Refrigerating Equipment), NEC 440.14 (disconnect a la vista del equipo) y NEC 440.22/440.32/440.33 (MOCP y calibre segun MCA)",
    sourceType: "regla_tecnica_general",
    shortAnswerEs:
      "El equipo de aire acondicionado/HVAC se dimensiona a partir de los datos de placa del fabricante, no de una regla generica: MCA (Minimum Circuit Ampacity, ampacidad minima del circuito) determina el calibre minimo del conductor, y MOCP (Maximum Overcurrent Protection, proteccion maxima contra sobrecorriente) determina el tamano maximo permitido del breaker o fusible. NEC 440.14 exige un medio de desconexion (disconnect) ubicado a la vista del equipo (o que pueda bloquearse en posicion abierta si no es practico tenerlo a la vista), accesible sin necesidad de escalera, para poder cortar la energia antes de dar servicio.",
    explanationEs:
      "MCA y MOCP vienen impresos en la placa del equipo (nameplate); NEC 440.22 establece la formula/metodo para calcular MOCP cuando la placa no lo indica directamente, pero el porcentaje exacto de esa formula no se asume aqui de memoria: debe verificarse contra el texto oficial de 440.22(A) y contra la placa real del equipo especifico, nunca inventarse. El calibre del conductor se selecciona para que su ampacidad sea igual o mayor al MCA marcado (440.32/440.33), aplicando los factores de correccion/ajuste que correspondan segun la instalacion real. El breaker o fusible instalado nunca debe exceder el MOCP marcado en la placa, aunque el conductor tenga capacidad para mas corriente.",
    riskLevel: "alto",
    checklistEs: [
      "Leer MCA y MOCP directamente de la placa del equipo",
      "Confirmar disconnect a la vista del equipo o bloqueable en posicion abierta (NEC 440.14)",
      "Seleccionar conductor con ampacidad igual o mayor al MCA marcado",
      "Confirmar que el breaker/fusible instalado no exceda el MOCP marcado",
      "Verificar formula de 440.22(A) contra el texto oficial si la placa no indica MOCP directamente"
    ],
    checklistEn: [
      "Read MCA and MOCP directly from the equipment nameplate",
      "Confirm the disconnect is within sight of the equipment or lockable in the open position (NEC 440.14)",
      "Select a conductor with ampacity equal to or greater than the marked MCA",
      "Confirm the installed breaker/fuse does not exceed the marked MOCP",
      "Verify the 440.22(A) formula against the official text if the nameplate doesn't state MOCP directly"
    ],
    commonMistakesEs: [
      "Seleccionar el breaker por el amperaje 'redondeado' del equipo en vez de leer el MOCP real de la placa",
      "Ubicar el disconnect fuera de la vista del equipo sin que sea bloqueable en posicion abierta",
      "Dimensionar el conductor por el amperaje del breaker en vez del MCA marcado en la placa"
    ],
    commonMistakesEn: [
      "Selecting the breaker by the equipment's rounded amperage instead of reading the actual MOCP from the nameplate",
      "Locating the disconnect out of sight of the equipment without it being lockable in the open position",
      "Sizing the conductor by the breaker's amperage instead of the nameplate MCA"
    ],
    shortAnswerEn:
      "Air-conditioning/HVAC equipment is sized from the manufacturer's nameplate data, not a generic rule: MCA (Minimum Circuit Ampacity) determines the minimum conductor size, and MOCP (Maximum Overcurrent Protection) determines the maximum allowed breaker or fuse size. NEC 440.14 requires a disconnecting means located within sight of the equipment (or lockable in the open position if within-sight isn't practical), accessible without a ladder, so power can be cut before servicing.",
    explanationEn:
      "MCA and MOCP are printed on the equipment nameplate; NEC 440.22 provides the formula/method to calculate MOCP when the nameplate doesn't state it directly, but the exact percentage in that formula is not assumed here from memory: it must be verified against the official text of 440.22(A) and against the specific equipment's actual nameplate, never invented. The conductor size is selected so its ampacity equals or exceeds the marked MCA (440.32/440.33), applying whatever correction/adjustment factors apply to the actual installation. The installed breaker or fuse must never exceed the nameplate MOCP, even if the conductor could carry more current.",
    missingQuestionsEs: ["Placa del equipo (MCA, MOCP, voltaje, fases)", "Ubicacion exacta del equipo respecto al disconnect", "Temperatura ambiente y numero de conductores en la misma tuberia"],
    missingQuestionsEn: ["Equipment nameplate (MCA, MOCP, voltage, phases)", "Exact equipment location relative to the disconnect", "Ambient temperature and number of conductors in the same raceway"],
    recommendationEs: "No fijar calibre de conductor ni tamano de breaker sin la placa real del equipo; escalar al Master Electrician si la placa no esta disponible o es ilegible.",
    recommendationEn: "Do not finalize conductor size or breaker size without the equipment's actual nameplate; escalate to the Master Electrician if the nameplate is unavailable or illegible.",
    warningEs:
      "Guia preliminar interna basada en NEC Article 440; MCA y MOCP dependen siempre de la placa del equipo especifico, nunca de un porcentaje generico asumido. Verificar el texto oficial de 440.22(A), la edicion adoptada por el AHJ y la aprobacion del Master Electrician antes de instalar.",
    warningEn:
      "Preliminary internal guide based on NEC Article 440; MCA and MOCP always depend on the specific equipment's nameplate, never on an assumed generic percentage. Verify the official text of 440.22(A), the edition adopted by the AHJ, and Master Electrician approval before installing."
  }
];

export { normalizeForMatch };

// Busqueda por score ponderado (ver lib/knowledge/matchEngine.ts), compartida
// entre el generador mock (lib/ai/mockAssistant.ts) y lib/db/dbAdapter.ts,
// para que ambos encuentren exactamente la misma categoria ante la misma
// pregunta.
//
// YA NO existe un pre-chequeo hardcodeado de disambiguacion (el anterior
// "si menciona iluminacion Y NO menciona receptaculos, ir directo a
// lighting" fue reemplazado por el motor de score generico: una entrada de
// lighting solo gana si su score ponderado supera a cualquier entrada de
// receptaculos/healthcare, y las entradas de healthcare exigen su propio
// gate de contexto). Devuelve null (no undefined) cuando ninguna entrada
// alcanza el score minimo de confianza: nunca se reutiliza contenido
// generico o relacionado solo por una palabra.
export function findKnowledgeBaseMatch(question: string): KnowledgeBaseEntry | null {
  return findBestMatch(question, ELECTRICAL_KNOWLEDGE_BASE);
}

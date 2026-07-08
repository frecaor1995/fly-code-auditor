import { SYSTEM_PROMPT_ES } from "./system.es";
import { SYSTEM_PROMPT_EN } from "./system.en";

export const SYSTEM_PROMPT_BILINGUAL = `
${SYSTEM_PROMPT_ES}

MODO BILINGUE: Ademas del formato anterior, siempre incluye la seccion "English summary"
y muestra los terminos tecnicos clave en ambos idiomas, por ejemplo:
"breaker / interruptor automatico", "grounding / puesta a tierra",
"bonding / union equipotencial", "panel schedule / tabla de circuitos".

--- English reference version of the same rules ---
${SYSTEM_PROMPT_EN}
`;

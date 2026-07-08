import OpenAI from "openai";
import type { AssistantResponse, Language } from "../db/types";
import { standardWarning, type AskAssistantInput, type AnalyzePlanInput } from "./types";
import { SYSTEM_PROMPT_ES } from "./prompts/system.es";
import { SYSTEM_PROMPT_EN } from "./prompts/system.en";
import { SYSTEM_PROMPT_BILINGUAL } from "./prompts/system.bilingual";

function systemPromptFor(language: Language): string {
  if (language === "en") return SYSTEM_PROMPT_EN;
  if (language === "bilingual") return SYSTEM_PROMPT_BILINGUAL;
  return SYSTEM_PROMPT_ES;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no esta configurada. Define USE_MOCK_AI=true para usar el motor local, o agrega la key en .env.local."
    );
  }
  return new OpenAI({ apiKey });
}

const JSON_INSTRUCTIONS = `
Responde UNICAMENTE con un objeto JSON valido (sin markdown, sin backticks) con esta forma exacta:
{
  "shortAnswer": string,
  "englishSummary": string | null,
  "riskLevel": "bajo" | "medio" | "alto" | "critico",
  "codeReference": string,
  "planReading": {
    "sheet": string | null,
    "symbolsVisible": string[],
    "equipmentIdentified": string[],
    "panelsIdentified": string[],
    "circuitsVisible": string[],
    "notes": string[],
    "missingInfo": string[]
  } | null,
  "checklist": string[],
  "missingQuestions": string[],
  "recommendation": string
}
No incluyas el campo "warning": se agrega automaticamente fuera del modelo.
`;

function parseModelJson(content: string, language: Language): AssistantResponse {
  const parsed = JSON.parse(content);
  return {
    shortAnswer: parsed.shortAnswer ?? "",
    englishSummary: parsed.englishSummary ?? undefined,
    riskLevel: parsed.riskLevel ?? "medio",
    codeReference: parsed.codeReference ?? "",
    planReading: parsed.planReading ?? undefined,
    checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
    missingQuestions: Array.isArray(parsed.missingQuestions) ? parsed.missingQuestions : [],
    recommendation: parsed.recommendation ?? "",
    // La advertencia final SIEMPRE se fuerza aqui, nunca se confia en que el
    // modelo la incluya o la redacte igual cada vez.
    warning: standardWarning(language)
  };
}

export async function openaiAskAssistant(input: AskAssistantInput): Promise<AssistantResponse> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPromptFor(input.language) + JSON_INSTRUCTIONS },
      {
        role: "user",
        content: input.projectContext
          ? `Contexto del proyecto: ${input.projectContext}\n\nPregunta: ${input.question}`
          : input.question
      }
    ]
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  return parseModelJson(content, input.language);
}

export async function openaiAnalyzePlan(input: AnalyzePlanInput): Promise<AssistantResponse> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  if (input.fileType !== "image" || !input.imageBase64) {
    throw new Error(
      "El analisis real con vision solo esta implementado para imagenes (JPG/PNG) en este MVP. Para PDFs, convierte la hoja a imagen o usa el motor mock."
    );
  }

  const userPrompt = `Hoja indicada por el usuario: ${input.sheet ?? "no especificada"}.\nPregunta: ${input.question}\nAnaliza SOLO lo que puedas ver con certeza en la imagen. Si algo no es legible, dilo explicitamente en vez de adivinar.`;

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPromptFor(input.language) + JSON_INSTRUCTIONS },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${input.imageBase64}` } }
        ]
      }
    ]
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  return parseModelJson(content, input.language);
}

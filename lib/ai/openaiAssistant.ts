import OpenAI from "openai";
import type { AssistantResponse } from "../db/types";
import type { AskAssistantInput, AnalyzePlanInput } from "./types";
import { systemPromptFor, JSON_INSTRUCTIONS, parseAssistantJson } from "./providers/shared";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no esta configurada. Define USE_MOCK_AI=true para usar el motor local, o agrega la key en .env.local."
    );
  }
  return new OpenAI({ apiKey });
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
  return parseAssistantJson(content, input.language);
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
  return parseAssistantJson(content, input.language);
}

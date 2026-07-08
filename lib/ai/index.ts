import type { AssistantResponse } from "../db/types";
import type { AskAssistantInput, AnalyzePlanInput } from "./types";
import { mockAskAssistant } from "./mockAssistant";
import { mockAnalyzePlan } from "./mockPlanAnalyzer";
import { openaiAskAssistant, openaiAnalyzePlan } from "./openaiAssistant";

function useMock(): boolean {
  return process.env.USE_MOCK_AI !== "false";
}

export async function askAssistant(input: AskAssistantInput): Promise<AssistantResponse> {
  return useMock() ? mockAskAssistant(input) : openaiAskAssistant(input);
}

export async function analyzePlan(input: AnalyzePlanInput): Promise<AssistantResponse> {
  return useMock() ? mockAnalyzePlan(input) : openaiAnalyzePlan(input);
}

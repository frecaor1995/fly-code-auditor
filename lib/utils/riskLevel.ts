import type { RiskLevel } from "../db/types";

export const RISK_ORDER: RiskLevel[] = ["bajo", "medio", "alto", "critico"];

export function riskColorClass(risk: RiskLevel): string {
  switch (risk) {
    case "bajo":
      return "bg-risk-low text-white";
    case "medio":
      return "bg-risk-medium text-white";
    case "alto":
      return "bg-risk-high text-white";
    case "critico":
      return "bg-risk-critical text-white";
  }
}

export function riskRequiresReview(risk: RiskLevel): boolean {
  return risk === "alto" || risk === "critico";
}

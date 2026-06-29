import type { LucideIcon } from "lucide-react";
import {
  Clock,
  ClipboardList,
  HeartPulse,
  MessageSquare,
  Pill,
  Scissors,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";

export type IntakeQuestionCategoryKey =
  | "chief_complaint"
  | "symptom_duration"
  | "current_medications"
  | "allergies"
  | "chronic_conditions"
  | "past_surgeries"
  | "family_history"
  | "additional_info"
  | "default";

type QuestionMeta = {
  categoryKey: IntakeQuestionCategoryKey;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
};

const QUESTION_META: Record<IntakeQuestionCategoryKey, QuestionMeta> = {
  chief_complaint: {
    categoryKey: "chief_complaint",
    icon: Stethoscope,
    accent: "text-brand-dark",
    iconBg: "bg-gradient-to-br from-brand to-brand-light",
  },
  symptom_duration: {
    categoryKey: "symptom_duration",
    icon: Clock,
    accent: "text-accent-dark",
    iconBg: "bg-gradient-to-br from-accent to-accent-light",
  },
  current_medications: {
    categoryKey: "current_medications",
    icon: Pill,
    accent: "text-violet-700",
    iconBg: "bg-gradient-to-br from-violet-500 to-violet-400",
  },
  allergies: {
    categoryKey: "allergies",
    icon: ShieldAlert,
    accent: "text-amber-700",
    iconBg: "bg-gradient-to-br from-amber-500 to-amber-400",
  },
  chronic_conditions: {
    categoryKey: "chronic_conditions",
    icon: HeartPulse,
    accent: "text-rose-700",
    iconBg: "bg-gradient-to-br from-rose-500 to-rose-400",
  },
  past_surgeries: {
    categoryKey: "past_surgeries",
    icon: Scissors,
    accent: "text-slate-700",
    iconBg: "bg-gradient-to-br from-slate-600 to-slate-500",
  },
  family_history: {
    categoryKey: "family_history",
    icon: Users,
    accent: "text-indigo-700",
    iconBg: "bg-gradient-to-br from-indigo-500 to-indigo-400",
  },
  additional_info: {
    categoryKey: "additional_info",
    icon: MessageSquare,
    accent: "text-teal-700",
    iconBg: "bg-gradient-to-br from-teal-500 to-teal-400",
  },
  default: {
    categoryKey: "default",
    icon: ClipboardList,
    accent: "text-brand-dark",
    iconBg: "bg-gradient-to-br from-brand to-brand-light",
  },
};

export function getQuestionMeta(key: string): QuestionMeta {
  if (key in QUESTION_META) {
    return QUESTION_META[key as IntakeQuestionCategoryKey];
  }
  return QUESTION_META.default;
}

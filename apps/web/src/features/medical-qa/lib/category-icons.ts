import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Baby,
  Bone,
  Brain,
  HeartPulse,
  HelpCircle,
  HousePlus,
  Pill,
  Salad,
  Sparkles,
  Stethoscope,
  Syringe,
  Venus,
} from "lucide-react";
import type { MedicalQaCategory } from "@zindagi/validators";

export const categoryIcons: Record<MedicalQaCategory, LucideIcon> = {
  general: Stethoscope,
  children: Baby,
  women: Venus,
  skin: Sparkles,
  "mental-health": Brain,
  "bones-joints": Bone,
  "heart-bp": HeartPulse,
  diabetes: Syringe,
  stomach: Salad,
  medicines: Pill,
  physiotherapy: Activity,
  "nursing-care": HousePlus,
  other: HelpCircle,
};

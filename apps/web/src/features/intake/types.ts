export type IntakeQuestionDto = {
  key: string;
  text: string;
  answer?: string;
  answeredAt?: string;
};

export type MedicalIntakeDto = {
  id: string;
  appointmentId: string;
  source: "chat" | "form";
  status: "pending" | "in_progress" | "completed";
  locale: "en" | "ur";
  currentQuestionIndex: number;
  questions: IntakeQuestionDto[];
  completedAt?: string;
};

export type DoctorIntakeQuestionDto = {
  id: string;
  text: string;
  order: number;
  isActive: boolean;
};

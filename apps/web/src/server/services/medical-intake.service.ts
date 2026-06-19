import {
  AppointmentModel,
  DoctorProfileModel,
  MedicalIntakeModel,
  NotificationModel,
  UserModel,
  connectDatabase,
} from "@zindagi/database";
import {
  AppError,
  DEFAULT_INTAKE_QUESTIONS,
  ErrorCodes,
  getDefaultIntakeQuestions,
  getPaidOnlineIntakeQuestions,
  IntakeSources,
  IntakeStatuses,
  normalizeIntakeLocale,
  NotificationChannels,
  resolveIntakeQuestionText,
  type IntakeLocale,
  type IntakeSource,
  type IntakeStatus,
} from "@zindagi/shared";
import { mongoFilter } from "@/lib/mongo/query";

export type IntakeQuestionDto = {
  key: string;
  text: string;
  answer?: string;
  answeredAt?: string;
};

export type MedicalIntakeDto = {
  id: string;
  appointmentId: string;
  source: IntakeSource;
  status: IntakeStatus;
  locale: IntakeLocale;
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

type IntakeRow = {
  _id: { toString(): string };
  appointmentId: { toString(): string };
  patientId: { toString(): string };
  doctorId: { toString(): string };
  source: string;
  status: string;
  currentQuestionIndex: number;
  questions: Array<{
    key: string;
    text: string;
    answer?: string | null;
    answeredAt?: Date | null;
  }>;
  completedAt?: Date | null;
  locale?: string | null;
};

function toDto(row: IntakeRow): MedicalIntakeDto {
  return {
    id: row._id.toString(),
    appointmentId: row.appointmentId.toString(),
    source: row.source as IntakeSource,
    status: row.status as IntakeStatus,
    locale: normalizeIntakeLocale(row.locale),
    currentQuestionIndex: row.currentQuestionIndex,
    questions: row.questions.map((q) => ({
      key: q.key,
      text: q.text,
      answer: q.answer ?? undefined,
      answeredAt: q.answeredAt ? q.answeredAt.toISOString() : undefined,
    })),
    completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
  };
}

/** Doctor's active custom questions, sorted; falls back to localized defaults. */
async function resolveQuestionSnapshot(
  doctorProfileId: string,
  locale: IntakeLocale,
  questionSet: "full" | "paid_online" = "full",
) {
  const profile = await DoctorProfileModel.findById(doctorProfileId).lean();
  const custom = (profile?.intakeQuestions ?? [])
    .filter((q) => q.isActive !== false)
    .sort((a, b) => a.order - b.order);

  if (custom.length > 0) {
    const selected =
      questionSet === "paid_online" ? custom.slice(0, 5) : custom;
    return selected.map((q) => ({ key: q.id, text: q.text }));
  }

  if (questionSet === "paid_online") {
    return getPaidOnlineIntakeQuestions(locale).map((q) => ({
      key: q.key,
      text: q.text,
    }));
  }

  return getDefaultIntakeQuestions(locale).map((q) => ({
    key: q.key,
    text: q.text,
  }));
}

async function resolvePatientLocale(patientId: string): Promise<IntakeLocale> {
  const patient = await UserModel.findById(patientId).select("metadata.locale").lean();
  return normalizeIntakeLocale(patient?.metadata?.locale);
}

async function resolveDoctorProfileIdForUser(doctorUserId: string) {
  const profile = await DoctorProfileModel.findOne(
    mongoFilter({ userId: doctorUserId }),
  ).lean();
  if (!profile) {
    throw new AppError("Doctor profile not found", ErrorCodes.NOT_FOUND, 404);
  }
  return profile;
}

async function notifyDoctorIntakeCompleted(params: {
  doctorProfileId: string;
  patientId: string;
  appointmentId: string;
}) {
  const profile = await DoctorProfileModel.findById(params.doctorProfileId).lean();
  if (!profile?.userId) return;

  const patient = await UserModel.findById(params.patientId)
    .select("name")
    .lean();

  await NotificationModel.create({
    userId: profile.userId.toString(),
    channel: NotificationChannels.IN_APP,
    title: "Medical history completed",
    body: `${patient?.name ?? "A patient"} has completed their pre-consult medical history.`,
    payload: {
      type: "intake_completed",
      appointmentId: params.appointmentId,
    },
    sentAt: new Date(),
  });
}

export class MedicalIntakeService {
  static async ensureConnected() {
    await connectDatabase();
  }

  /**
   * Creates the intake for a confirmed appointment, snapshotting the doctor's
   * current question list. Idempotent: returns the existing intake if present.
   */
  static async createForAppointment(
    appointmentId: string,
    source: IntakeSource,
    preferredLocale?: string | null,
    options?: { questionSet?: "full" | "paid_online" },
  ): Promise<MedicalIntakeDto> {
    await MedicalIntakeService.ensureConnected();

    const existing = await MedicalIntakeModel.findOne(
      mongoFilter({ appointmentId }),
    ).lean();
    if (existing) return toDto(existing as unknown as IntakeRow);

    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const locale = preferredLocale
      ? normalizeIntakeLocale(preferredLocale)
      : await resolvePatientLocale(appointment.patientId.toString());
    const questions = await resolveQuestionSnapshot(
      appointment.doctorId.toString(),
      locale,
      options?.questionSet ?? "full",
    );

    const created = await MedicalIntakeModel.create({
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      source,
      locale,
      status: IntakeStatuses.PENDING,
      currentQuestionIndex: 0,
      questions,
    });

    return toDto(created.toObject() as unknown as IntakeRow);
  }

  /**
   * Seeds a new appointment intake as already completed, copying answers from a
   * prior visit with the same doctor so returning patients skip chat questions.
   */
  static async createCompletedFromPrior(
    appointmentId: string,
    prior: MedicalIntakeDto,
    source: IntakeSource,
    preferredLocale?: string | null,
  ): Promise<MedicalIntakeDto> {
    await MedicalIntakeService.ensureConnected();

    const existing = await MedicalIntakeModel.findOne(
      mongoFilter({ appointmentId }),
    ).lean();
    if (existing) return toDto(existing as unknown as IntakeRow);

    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new AppError("Appointment not found", ErrorCodes.NOT_FOUND, 404);
    }

    const locale = preferredLocale
      ? normalizeIntakeLocale(preferredLocale)
      : normalizeIntakeLocale(prior.locale);
    const questions = prior.questions.map((question) => ({
      key: question.key,
      text: question.text,
      answer: question.answer,
      answeredAt: question.answeredAt
        ? new Date(question.answeredAt)
        : undefined,
    }));

    const created = await MedicalIntakeModel.create({
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      source,
      locale,
      status: IntakeStatuses.COMPLETED,
      currentQuestionIndex: questions.length,
      questions,
      completedAt: new Date(),
    });

    return toDto(created.toObject() as unknown as IntakeRow);
  }

  /** Marks an in-flight intake as completed using a prior visit's answers. */
  static async upgradeToCompletedFromPrior(
    appointmentId: string,
    prior: MedicalIntakeDto,
  ): Promise<MedicalIntakeDto | null> {
    await MedicalIntakeService.ensureConnected();

    const intake = await MedicalIntakeModel.findOne(
      mongoFilter({ appointmentId }),
    );
    if (!intake || intake.status === IntakeStatuses.COMPLETED) return null;

    intake.set(
      "questions",
      prior.questions.map((question) => ({
        key: question.key,
        text: question.text,
        answer: question.answer,
        answeredAt: question.answeredAt
          ? new Date(question.answeredAt)
          : undefined,
      })),
    );
    intake.status = IntakeStatuses.COMPLETED;
    intake.currentQuestionIndex = intake.questions.length;
    intake.completedAt = new Date();
    intake.locale = normalizeIntakeLocale(prior.locale);
    await intake.save();

    return toDto(intake.toObject() as unknown as IntakeRow);
  }

  /** Latest completed intake for a patient with a given doctor (any prior appointment). */
  static async findLatestCompletedWithDoctor(
    patientUserId: string,
    doctorProfileId: string,
    excludeAppointmentId?: string,
  ): Promise<MedicalIntakeDto | null> {
    await MedicalIntakeService.ensureConnected();

    const filter: Record<string, unknown> = {
      patientId: patientUserId,
      doctorId: doctorProfileId,
      status: IntakeStatuses.COMPLETED,
    };
    if (excludeAppointmentId) {
      filter.appointmentId = { $ne: excludeAppointmentId };
    }

    const intake = await MedicalIntakeModel.findOne(mongoFilter(filter))
      .sort({ completedAt: -1 })
      .lean();

    return intake ? toDto(intake as unknown as IntakeRow) : null;
  }

  /** Intake for an appointment regardless of status, or null. */
  static async getForAppointment(
    appointmentId: string,
  ): Promise<MedicalIntakeDto | null> {
    await MedicalIntakeService.ensureConnected();

    const intake = await MedicalIntakeModel.findOne(
      mongoFilter({ appointmentId }),
    ).lean();

    return intake ? toDto(intake as unknown as IntakeRow) : null;
  }

  /** Active chat-driven intake for an appointment, if any answer is still pending. */
  static async getActiveChatIntake(appointmentId: string) {
    await MedicalIntakeService.ensureConnected();

    const intake = await MedicalIntakeModel.findOne(
      mongoFilter({
        appointmentId,
        source: IntakeSources.CHAT,
        status: { $in: [IntakeStatuses.PENDING, IntakeStatuses.IN_PROGRESS] },
      }),
    ).lean();

    return intake ? toDto(intake as unknown as IntakeRow) : null;
  }

  /**
   * Records a patient chat message as the answer to the current question.
   * Returns the next question text (if any) and whether the intake completed.
   */
  static async recordChatAnswer(
    appointmentId: string,
    patientUserId: string,
    answer: string,
    preferredLocale?: string | null,
  ): Promise<{
    recorded: boolean;
    locale: IntakeLocale;
    nextQuestion?: string;
    completed: boolean;
    questionNumber?: number;
    totalQuestions?: number;
  }> {
    await MedicalIntakeService.ensureConnected();

    const intake = await MedicalIntakeModel.findOne(
      mongoFilter({
        appointmentId,
        patientId: patientUserId,
        source: IntakeSources.CHAT,
        status: { $in: [IntakeStatuses.PENDING, IntakeStatuses.IN_PROGRESS] },
      }),
    );

    if (!intake) return { recorded: false, completed: false, locale: "en" };

    const index = intake.currentQuestionIndex;
    const question = intake.questions[index];
    if (!question) {
      return {
        recorded: false,
        completed: false,
        locale: normalizeIntakeLocale(intake.locale),
      };
    }

    const locale = normalizeIntakeLocale(preferredLocale ?? intake.locale);

    question.answer = answer.trim().slice(0, 2000);
    question.answeredAt = new Date();

    const nextIndex = index + 1;
    const isLast = nextIndex >= intake.questions.length;

    intake.currentQuestionIndex = nextIndex;
    intake.status = isLast ? IntakeStatuses.COMPLETED : IntakeStatuses.IN_PROGRESS;
    if (isLast) intake.completedAt = new Date();
    intake.locale = locale;

    await intake.save();

    if (isLast) {
      await notifyDoctorIntakeCompleted({
        doctorProfileId: intake.doctorId.toString(),
        patientId: patientUserId,
        appointmentId,
      });
      return { recorded: true, completed: true, locale };
    }

    const nextQ = intake.questions[nextIndex]!;
    return {
      recorded: true,
      completed: false,
      locale,
      nextQuestion: resolveIntakeQuestionText(nextQ, locale),
      questionNumber: nextIndex + 1,
      totalQuestions: intake.questions.length,
    };
  }

  /** Patient view of their own intake (form flow + status checks). */
  static async getForPatient(
    appointmentId: string,
    patientUserId: string,
  ): Promise<MedicalIntakeDto> {
    await MedicalIntakeService.ensureConnected();

    const intake = await MedicalIntakeModel.findOne(
      mongoFilter({ appointmentId, patientId: patientUserId }),
    ).lean();

    if (!intake) {
      throw new AppError("Medical history not found", ErrorCodes.NOT_FOUND, 404);
    }

    return toDto(intake as unknown as IntakeRow);
  }

  /** Sunday form submission: saves all answers at once and completes the intake. */
  static async submitForm(
    appointmentId: string,
    patientUserId: string,
    answers: Array<{ key: string; answer: string }>,
  ): Promise<MedicalIntakeDto> {
    await MedicalIntakeService.ensureConnected();

    const intake = await MedicalIntakeModel.findOne(
      mongoFilter({ appointmentId, patientId: patientUserId }),
    );

    if (!intake) {
      throw new AppError("Medical history not found", ErrorCodes.NOT_FOUND, 404);
    }

    if (intake.status === IntakeStatuses.COMPLETED) {
      throw new AppError(
        "Medical history has already been submitted",
        ErrorCodes.CONFLICT,
        409,
      );
    }

    const answerByKey = new Map(
      answers.map((a) => [a.key, a.answer.trim().slice(0, 2000)]),
    );

    const now = new Date();
    for (const question of intake.questions) {
      const answer = answerByKey.get(question.key);
      if (answer !== undefined && answer.length > 0) {
        question.answer = answer;
        question.answeredAt = now;
      }
    }

    const hasAnyAnswer = intake.questions.some((q) => !!q.answer);

    intake.status = IntakeStatuses.COMPLETED;
    intake.completedAt = now;
    intake.currentQuestionIndex = intake.questions.length;
    await intake.save();

    if (hasAnyAnswer) {
      await notifyDoctorIntakeCompleted({
        doctorProfileId: intake.doctorId.toString(),
        patientId: patientUserId,
        appointmentId,
      });
    }

    return toDto(intake.toObject() as unknown as IntakeRow);
  }

  /** Doctor view of a patient's intake for one of their own appointments. */
  static async getForDoctor(
    appointmentId: string,
    doctorUserId: string,
  ): Promise<MedicalIntakeDto | null> {
    await MedicalIntakeService.ensureConnected();

    const profile = await resolveDoctorProfileIdForUser(doctorUserId);

    const intake = await MedicalIntakeModel.findOne(
      mongoFilter({ appointmentId, doctorId: profile._id.toString() }),
    ).lean();

    return intake ? toDto(intake as unknown as IntakeRow) : null;
  }

  /** Doctor's question list for editing; defaults are returned when not customized. */
  static async getDoctorQuestions(
    doctorUserId: string,
  ): Promise<{ questions: DoctorIntakeQuestionDto[]; isCustomized: boolean }> {
    await MedicalIntakeService.ensureConnected();

    const profile = await resolveDoctorProfileIdForUser(doctorUserId);
    const custom = profile.intakeQuestions ?? [];

    if (custom.length > 0) {
      return {
        questions: [...custom]
          .sort((a, b) => a.order - b.order)
          .map((q) => ({
            id: q.id,
            text: q.text,
            order: q.order,
            isActive: q.isActive !== false,
          })),
        isCustomized: true,
      };
    }

    return {
      questions: DEFAULT_INTAKE_QUESTIONS.map((q, index) => ({
        id: q.key,
        text: q.text,
        order: index,
        isActive: true,
      })),
      isCustomized: false,
    };
  }

  /** Saves the doctor's customized question list (affects future bookings only). */
  static async updateDoctorQuestions(
    doctorUserId: string,
    questions: Array<{
      id: string;
      text: string;
      order: number;
      isActive: boolean;
    }>,
  ): Promise<{ questions: DoctorIntakeQuestionDto[]; isCustomized: boolean }> {
    await MedicalIntakeService.ensureConnected();

    const profile = await resolveDoctorProfileIdForUser(doctorUserId);

    // Empty list resets to the hardcoded defaults; otherwise at least one
    // question must remain active.
    if (questions.length > 0 && !questions.some((q) => q.isActive)) {
      throw new AppError(
        "At least one active question is required",
        ErrorCodes.VALIDATION,
        400,
      );
    }

    await DoctorProfileModel.updateOne(
      mongoFilter({ _id: profile._id }),
      { $set: { intakeQuestions: questions } },
    );

    return MedicalIntakeService.getDoctorQuestions(doctorUserId);
  }
}

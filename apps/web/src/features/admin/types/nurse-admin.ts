export type AdminNurseVisitRow = {
  id: string;
  serviceType: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
  address: { line: string; city: string };
  patient: { id: string; name: string; phone?: string };
  pricing: { total: number; currency: string };
};

export type AdminNurseDetailDto = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    city: string;
    memberSince: string;
  };
  verificationStatus: string;
  verificationSubmittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
  licenseNumber?: string;
  qualification?: string;
  experienceYears?: number;
  cnicLast4?: string;
  isAvailable: boolean;
  homeVisitEnabled: boolean;
  employeeCode?: string;
  serviceArea: { city: string; area?: string; radiusKm: number };
  documents: { label: string; url: string }[];
  stats: {
    activeVisits: number;
    completedTotal: number;
    completedThisMonth: number;
    totalEarnings: number;
    earningsThisMonth: number;
  };
  visitHistory: AdminNurseVisitRow[];
};

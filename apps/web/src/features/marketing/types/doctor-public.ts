export type PublicDoctorHospital = {
  name: string;
  city: string;
  address?: string;
};

export type PublicDoctorProfile = {
  doctorId: string;
  slug: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  bio?: string;
  experienceYears: number;
  languages: string[];
  medicalDegree?: string;
  qualifications: string[];
  medicalCollege?: string;
  graduationYear?: number;
  hospitals: PublicDoctorHospital[];
  pmdcVerified: boolean;
  consultationFee: number;
  ratingAvg: number;
  ratingCount: number;
  availableSlots: number;
  isFull: boolean;
  videoConsultEnabled: boolean;
};

export type DoctorReviewDto = {
  id: string;
  rating: number;
  comment?: string;
  patientName: string;
  createdAt: string;
};

export type FeaturedDoctorCard = {
  doctorId: string;
  slug: string;
  name: string;
  specialty: string;
  hospital: string;
  rating: number;
  reviews: number;
  fee: number;
  pmdcVerified: boolean;
  imageUrl?: string;
  medicalDegree?: string;
  qualifications: string[];
};

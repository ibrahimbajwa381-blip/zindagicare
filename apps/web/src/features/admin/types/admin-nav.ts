/** Actionable item counts shown beside admin sidebar links. */
export type AdminNavCounts = {
  doctors: number;
  nurses: number;
  physiotherapists: number;
  herbalists: number;
  nutritionists: number;
  sundayConsult: number;
  urgentCare: number;
  /** Open home visits (requested or assigned), one count per provider queue. */
  homeVisitsDoctor: number;
  homeVisitsPhysiotherapist: number;
  homeVisitsNurse: number;
  /** Reviews waiting for moderation, one count per review category. */
  reviewsDoctor: number;
  reviewsPhysiotherapist: number;
  reviewsNurse: number;
};

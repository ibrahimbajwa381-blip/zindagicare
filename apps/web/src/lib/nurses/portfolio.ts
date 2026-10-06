/**
 * Nurses share the physiotherapist portfolio shape (both live on StaffProfile.portfolio), so
 * the mapping and scoring are reused; only the checklist copy differs (role "nurse").
 */
export {
  formatExperienceYears,
  mapPhysiotherapistPortfolio as mapNursePortfolio,
  portfolioCompleteness,
  type PhysiotherapistPortfolio as NursePortfolio,
  type PortfolioAward,
  type PortfolioCertification,
  type PortfolioChecklistItem,
  type PortfolioEducation,
  type PortfolioExperience,
  type PortfolioSectionId,
} from "@/lib/physiotherapists/portfolio";

import {
  portfolioChecklist,
  type PhysiotherapistPortfolio,
} from "@/lib/physiotherapists/portfolio";

/** Portfolio checklist with nurse-specific hints. */
export function nursePortfolioChecklist(portfolio: PhysiotherapistPortfolio, avatarUrl?: string) {
  return portfolioChecklist(portfolio, avatarUrl, "nurse");
}

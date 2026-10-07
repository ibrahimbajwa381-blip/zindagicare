"use client";

import { useMemo, useState } from "react";
import { siteConfig } from "@/config/site";
import { featuredSpecialties } from "../data/browse-catalog";
import { BrowseSectionRow } from "./browse-section-row";
import { SpecialtyBrowseModal } from "./specialty-browse-modal";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { localizeBrowseItems } from "@/i18n/browse";

export function SpecialtiesBrowseSection() {
  const [modalOpen, setModalOpen] = useState(false);
  // The modal holds ~135 specialty tiles (~700 DOM nodes); mount it on first open
  // instead of server-rendering and hydrating it hidden on every home page load.
  const [modalMounted, setModalMounted] = useState(false);
  const { locale } = useLocale();
  const t = useTranslations();

  const specialties = useMemo(
    () => localizeBrowseItems(featuredSpecialties, locale),
    [locale],
  );

  return (
    <>
      <BrowseSectionRow
        title={t.doctors.browseTitle}
        items={specialties}
        queryParam="specialty"
        viewAllLabel={t.common.viewAll}
        onViewAllClick={() => {
          setModalMounted(true);
          setModalOpen(true);
        }}
      />

      {modalMounted ? (
        <SpecialtyBrowseModal open={modalOpen} onOpenChange={setModalOpen} />
      ) : null}
    </>
  );
}

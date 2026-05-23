export type BrowseItem = {
  slug: string;
  label: string;
  /** Path under /public, e.g. /browse/specialties/dermatologist.svg */
  image: string;
  /** Tailwind gradient classes for the icon circle */
  ring: string;
};

export {
  allSpecialties,
  featuredSpecialties,
  slugifySpecialty,
} from "./specialty-utils";

export { conditionBrowse } from "./condition-browse";

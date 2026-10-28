export interface LegalResource {
  id: string;
  name: string;
  scope: string;
  description: string;
  phone: string;
  phoneHref: string;
  email?: string;
  contactUrl: string;
}

const ADIL_PARIS: LegalResource = {
  id: "adil-paris",
  name: "ADIL de Paris",
  scope: "Paris",
  description:
    "Information gratuite sur le bail, les réparations, les charges et les litiges locatifs.",
  phone: "01 42 79 50 50",
  phoneHref: "+33142795050",
  contactUrl: "https://www.adil75.org/contact/",
};

const ADIL_RHONE: LegalResource = {
  id: "adil-rhone",
  name: "ADIL du Rhône",
  scope: "Lyon et Rhône",
  description:
    "Information gratuite sur le bail, les réparations, les charges et les litiges locatifs.",
  phone: "04 78 52 84 84",
  phoneHref: "+33478528484",
  contactUrl: "https://www.adil69.org/adil-69/contactez-nous/",
};

const ANIL: LegalResource = {
  id: "anil",
  name: "ANIL",
  scope: "France",
  description:
    "Service national d’information juridique sur le logement, accessible par téléphone ou formulaire.",
  phone: "0 820 16 75 00",
  phoneHref: "+33820167500",
  email: "anil@anil.org",
  contactUrl: "https://www.anil.org/contact/",
};

function postalCodeFor(address: string) {
  return address.match(/\b(\d{5})\b/)?.[1];
}

export function legalResourcesFor(address: string | null | undefined) {
  const postalCode = postalCodeFor(address || "");
  if (postalCode?.startsWith("75")) return [ADIL_PARIS, ANIL];
  if (postalCode?.startsWith("69")) return [ADIL_RHONE, ANIL];
  return [ANIL];
}

// One-off generator for the contract document previews (real static SVG files).
// Run with: node scripts/generate-contract-assets.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "images", "contracts");
mkdirSync(outDir, { recursive: true });

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function doc({ accent = "#456C5A", accentSoft = "#EEF5F1", reference, eyebrow, title, subtitle, fields = [], blocks = [], footer = "Document de démonstration LIAISON — aperçu non contractuel.", table = null }) {
  const fieldRows = fields
    .map(
      (field, index) => `
    <text x="48" y="${482 + index * 26}" font-family="Helvetica, Arial" font-size="10" fill="#6D7679">${esc(field[0])}</text>
    <text x="552" y="${482 + index * 26}" text-anchor="end" font-family="Helvetica, Arial" font-size="10" font-weight="700" fill="#1C272C">${esc(field[1])}</text>`,
    )
    .join("");

  const blocksMarkup = blocks
    .map(
      (block, index) => `
  <text x="48" y="${640 + index * 62}" font-family="Helvetica, Arial" font-size="9" font-weight="700" fill="${accent}" letter-spacing=".8">${esc(block.title)}</text>
  <text x="48" y="${658 + index * 62}" font-family="Helvetica, Arial" font-size="9.5" fill="#445155">${esc(block.text)}</text>`,
    )
    .join("");

  const tableMarkup = table
    ? `
  <g font-family="Helvetica, Arial" font-size="9">
    ${table
      .map(
        (row, index) => `
    <rect x="48" y="${430 + index * 34}" width="504" height="28" rx="6" fill="${index % 2 === 0 ? "#F7F6F1" : "#FBFAF6"}" stroke="#E7E6DF"/>
    <text x="62" y="${448 + index * 34}" font-size="9" font-weight="700" fill="#1C272C">${esc(row[0])}</text>
    <text x="300" y="${448 + index * 34}" font-size="9" fill="#445155">${esc(row[1])}</text>
    <text x="538" y="${448 + index * 34}" text-anchor="end" font-size="9" font-weight="700" fill="${accent}">${esc(row[2])}</text>`,
      )
      .join("")}
  </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850">
  <rect width="600" height="850" fill="#FBFAF6"/>
  <rect x="0" y="0" width="600" height="10" fill="#243B47"/>
  <rect x="48" y="48" width="42" height="42" rx="12" fill="#243B47"/>
  <path d="M62 78h14M64 70h10M69 62v8m-5-4h10" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>
  <text x="103" y="67" font-family="Helvetica, Arial" font-size="18" font-weight="700" fill="#243B47" letter-spacing="1.5">LIAISON</text>
  <text x="103" y="82" font-family="Helvetica, Arial" font-size="9" fill="#6D7679">24 rue des Lilas, Paris</text>
  <rect x="408" y="52" width="144" height="30" rx="8" fill="${accentSoft}"/>
  <text x="480" y="71" text-anchor="middle" font-family="Helvetica, Arial" font-size="10" font-weight="700" fill="${accent}" letter-spacing=".6">${esc(reference)}</text>
  <text x="48" y="134" font-family="Helvetica, Arial" font-size="9" font-weight="700" fill="${accent}" letter-spacing="1">${esc(eyebrow)}</text>
  <text x="48" y="166" font-family="Georgia, serif" font-size="25" font-weight="700" fill="#1C272C">${esc(title)}</text>
  <text x="48" y="188" font-family="Helvetica, Arial" font-size="9" fill="#6D7679" letter-spacing=".5">${esc(subtitle)}</text>
  <line x1="48" y1="206" x2="552" y2="206" stroke="#E7E6DF"/>
  ${
    table
      ? tableMarkup
      : `<rect x="48" y="438" width="504" height="${Math.max(fields.length * 26 + 34, 74)}" rx="10" fill="#F7F6F1" stroke="#E7E6DF"/>
  <text x="62" y="462" font-family="Helvetica, Arial" font-size="8" font-weight="700" fill="#6D7679" letter-spacing=".8">INFORMATIONS CLÉS</text>
  ${fieldRows.replaceAll('x="48" y="482', 'x="62" y="482')}`
  }
  ${blocksMarkup}
  <line x1="48" y1="742" x2="552" y2="742" stroke="#E7E6DF"/>
  <text x="48" y="764" font-family="Helvetica, Arial" font-size="8" fill="#6D7679">${esc(footer)}</text>
  <rect x="48" y="786" width="150" height="34" rx="8" fill="${accentSoft}"/>
  <text x="123" y="807" text-anchor="middle" font-family="Helvetica, Arial" font-size="8.5" font-weight="700" fill="${accent}">SIGNATURE eIDAS</text>
  <text x="552" y="798" text-anchor="end" font-family="Helvetica, Arial" font-size="8" fill="#6D7679">Empreinte : 9f2c·a71b·4e08·c3d5</text>
  <text x="552" y="812" text-anchor="end" font-family="Helvetica, Arial" font-size="8" fill="#6D7679">Horodatage certifié · LIAISON</text>
</svg>
`;
}

const docs = {
  "assurance-habitation.svg": doc({
    reference: "ASSUR-2026",
    eyebrow: "ASSURANCE HABITATION · LOI ALUR",
    title: "Attestation d'assurance habitation",
    subtitle: "Multirisque habitation — locataire · année 2026",
    accent: "#456C5A",
    accentSoft: "#EEF5F1",
    fields: [
      ["Assuré", "Thomas Martin"],
      ["Logement assuré", "24 rue des Lilas, Bât. B — Paris 11e"],
      ["Formule", "Multirisque habitation"],
      ["Effet du contrat", "1er janvier 2026"],
      ["Échéance", "31 décembre 2026"],
      ["Cotisation", "18,40 € / mois"],
    ],
    blocks: [
      { title: "GARANTIES COUVERTES", text: "Incendie, dégâts des eaux, dégâts électriques, vol et recours des voisins." },
      { title: "ATTESTATION", text: "Le locataire est couvert pour les risques locatifs pendant toute la durée du bail." },
    ],
  }),
  "cautionnement.svg": doc({
    reference: "CAUT-2024",
    eyebrow: "GARANTIE LOCATIVE",
    title: "Acte de cautionnement",
    subtitle: "Caution solidaire — loi n° 89-462 du 6 juillet 1989",
    accent: "#8A4C1F",
    accentSoft: "#FBF0E4",
    fields: [
      ["Caution", "Garant du locataire"],
      ["Bail garanti", "BAIL-75-992"],
      ["Logement", "24 rue des Lilas, Bât. B — Paris 11e"],
      ["Montant garanti", "3 240 € (3 mois de loyer)"],
      ["Durée", "Durée du bail, reconduction incluse"],
      ["Date de signature", "15 octobre 2024"],
    ],
    blocks: [
      { title: "ENGAGEMENT", text: "Le garant s'engage à payer les loyers et charges en cas de défaillance du locataire." },
    ],
  }),
  "notice-information.svg": doc({
    reference: "NOTICE-89-462",
    eyebrow: "INFORMATION DU LOCATAIRE",
    title: "Notice d'information officielle",
    subtitle: "Droits et obligations des locataires et propriétaires",
    accent: "#2A566A",
    accentSoft: "#F0F5F8",
    fields: [
      ["Texte de référence", "Loi n° 89-462 du 6 juillet 1989"],
      ["Annexe au bail", "Oui — annexe obligatoire"],
      ["Parties concernées", "Locataire et bailleur"],
      ["Remise au locataire", "15 octobre 2024"],
      ["Format", "8 pages"],
      ["Version", "À jour au 1er janvier 2026"],
    ],
    blocks: [
      { title: "OBJET", text: "Cette notice rappelle les droits et obligations réciproques prévus par la loi." },
      { title: "THÈMES ABORDÉS", text: "Loyer, charges, dépôt de garantie, travaux, préavis, état des lieux et litiges." },
    ],
  }),
  "ddt-cover.svg": doc({
    reference: "DDT-75-992",
    eyebrow: "DOSSIER DE DIAGNOSTIC TECHNIQUE",
    title: "Dossier de diagnostic technique",
    subtitle: "Diagnostics applicables au logement — annexé au bail",
    accent: "#243B47",
    accentSoft: "#E4EAED",
    table: [
      ["DPE", "Diagnostic de performance énergétique", "D"],
      ["Électricité", "Installation intérieure", "Conforme"],
      ["Gaz", "Installation intérieure", "Conforme"],
      ["Surface Carrez", "Loi Carrez", "48 m²"],
      ["Plomb (CREP)", "Immeuble post-1949", "Non applicable"],
      ["Amiante", "Immeuble post-1997", "Non applicable"],
    ],
    blocks: [
      { title: "VALIDITÉ", text: "DPE et GES valides jusqu'en 2034 · électricité 6 ans · gaz 3 ans." },
      { title: "TRAÇABILITÉ", text: "Diagnostics réalisés le 28 août et le 2 septembre 2024 par un diagnostiqueur certifié." },
    ],
  }),
  "diagnostic-dpe.svg": doc({
    reference: "DPE-2024",
    eyebrow: "DIAGNOSTIC DE PERFORMANCE ÉNERGÉTIQUE",
    title: "DPE & GES",
    subtitle: "Logement 48 m² — 24 rue des Lilas, Paris 11e",
    accent: "#8A4C1F",
    accentSoft: "#FBF0E4",
    fields: [
      ["Classe énergie", "D"],
      ["Consommation", "231 kWh/m²/an"],
      ["Classe climat", "D"],
      ["Émissions", "32 kg CO₂/m²/an"],
      ["Date du diagnostic", "2 septembre 2024"],
      ["Validité", "Jusqu'en 2034"],
    ],
    blocks: [
      { title: "MÉTHODE", text: "Diagnostic établi selon la méthode 3CL-DPE 2021 sur la base des caractéristiques du bâti." },
    ],
  }),
  "diagnostic-electricite.svg": doc({
    reference: "ELEC-2024",
    eyebrow: "DIAGNOSTIC ÉLECTRICITÉ",
    title: "Installation électrique",
    subtitle: "Rapport de vérification — logement 48 m²",
    accent: "#456C5A",
    accentSoft: "#EEF5F1",
    fields: [
      ["Résultat", "Conforme"],
      ["Installation", "Intérieure, tableau et prises"],
      ["Anomalies relevées", "Aucune anomalie majeure"],
      ["Date du diagnostic", "28 août 2024"],
      ["Validité", "6 ans — jusqu'au 28 août 2030"],
      ["Diagnostiqueur", "Certifié Cofrac"],
    ],
    blocks: [
      { title: "OBSERVATIONS", text: "Mise à la terre présente sur l'ensemble des circuits contrôlés." },
    ],
  }),
  "diagnostic-gaz.svg": doc({
    reference: "GAZ-2024",
    eyebrow: "DIAGNOSTIC GAZ",
    title: "Installation gaz",
    subtitle: "Rapport de vérification — raccordement collectif",
    accent: "#456C5A",
    accentSoft: "#EEF5F1",
    fields: [
      ["Résultat", "Conforme"],
      ["Installation", "Chaudière collective — bâtiment B"],
      ["Anomalies relevées", "Aucune"],
      ["Date du diagnostic", "28 août 2024"],
      ["Validité", "3 ans — jusqu'au 28 août 2027"],
      ["Diagnostiqueur", "Certifié Cofrac"],
    ],
    blocks: [
      { title: "OBSERVATIONS", text: "Ventilation et évacuation des produits de combustion conformes." },
    ],
  }),
  "diagnostic-carrez.svg": doc({
    reference: "CARREZ-2024",
    eyebrow: "SURFACE CARREZ",
    title: "Attestation de surface",
    subtitle: "Loi n° 96-1107 du 18 décembre 1996",
    accent: "#2A566A",
    accentSoft: "#F0F5F8",
    fields: [
      ["Surface privative", "48 m²"],
      ["Méthode", "Loi Carrez"],
      ["Bien mesuré", "Appartement T2 — lot n° 12"],
      ["Date du mesurage", "28 août 2024"],
      ["Validité", "Attestation définitive"],
      ["Cabinet", "Métrage Île-de-France"],
    ],
    blocks: [
      { title: "MENTION", text: "La surface est certifiée pour la vente et l'information du locataire." },
    ],
  }),
  "reglement-copropriete.svg": doc({
    reference: "COPRO-LILAS",
    eyebrow: "COPROPRIÉTÉ",
    title: "Extrait du règlement de copropriété",
    subtitle: "Résidence Les Lilas — 24 rue des Lilas, Paris 11e",
    accent: "#2A566A",
    accentSoft: "#F0F5F8",
    fields: [
      ["Copropriété", "Résidence Les Lilas"],
      ["Lot loué", "Lot n° 12 — appartement T2"],
      ["Usage du lot", "Habitation — résidence principale"],
      ["Charges", "Provisions sur charges locatives"],
      ["Syndic", "Agence Horizon Gestion"],
      ["Date du règlement", "12 juin 1998 — mis à jour en 2024"],
    ],
    blocks: [
      { title: "EXTRAIT — JOUISSANCE", text: "Le copropriétaire et ses locataires jouissent des parties communes dans le respect du règlement." },
      { title: "EXTRAIT — TRAVAUX", text: "Les travaux affectant les parties communes sont soumis à l'accord de l'assemblée générale." },
    ],
  }),
  "inventaire-mobilier.svg": doc({
    reference: "MOBILIER-2024",
    eyebrow: "INVENTAIRE DU MOBILIER",
    title: "Inventaire du mobilier",
    subtitle: "Logement meublé — annexe au bail",
    accent: "#6D7679",
    accentSoft: "#F2F1EC",
    fields: [
      ["Logement", "24 rue des Lilas, Bât. B"],
      ["Statut du logement", "Meublé"],
      ["Date", "1er septembre 2024"],
      ["Pièces meublées", "5 pièces"],
      ["Signataires", "Bailleur et locataire"],
      ["Photos", "38 clichés"],
    ],
    blocks: [
      { title: "OBJET", text: "Liste détaillée des meubles et équipements fournis avec le logement." },
    ],
  }),
};

for (const [name, svg] of Object.entries(docs)) {
  writeFileSync(join(outDir, name), svg, "utf8");
  console.log("written", join("public", "images", "contracts", name));
}

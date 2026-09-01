/**
 * Per-user locale resolution for AI prompts.
 *
 * Every AI prompt in this app was written for one country. "You are a certified
 * Indian health coach", "use ONLY authentic Indian foods", a Northern-Hemisphere
 * monsoon calendar, a `nameHindi` field, portions in katoris. That is correct
 * for the users the app launched with and wrong for everyone else — a user in
 * São Paulo was being told to eat sarson saag in July, which is winter there.
 *
 * This module turns the columns the users table already carries (country_code,
 * language_code) into the handful of strings a prompt needs. It is deliberately
 * NOT a general i18n framework:
 *
 *   - India's output must not change by a single character. The season strings,
 *     the cuisine word and the portion hint for IN are the literals that were
 *     inline before, and a test asserts it.
 *   - Country and language NAMES come from Intl.DisplayNames rather than a
 *     250-row table, so an unlisted country still reads correctly.
 *   - Only cuisine, season and portions need judgement, so only those are
 *     tables — and each falls back to something honest ("local foods commonly
 *     eaten in Kenya") rather than to India.
 *
 * NOT handled here, deliberately: the calendar day. Day boundaries are still
 * IST app-wide (see lib/dateUtils) because the Health Score engine, the streak
 * logic, the diet chart's week key and every cached row agree on that anchor.
 * Moving to per-user timezones is a change to all of them at once, not to a
 * prompt.
 */

export type Hemisphere = "north" | "south" | "tropical";

export type UserLocale = {
  countryCode: string;
  languageCode: string;
  countryName: string;
  /** English name of the user's language, e.g. "Tamil" — for `nameLocal`. */
  languageName: string;
  /** Adjective for the cuisine, e.g. "Indian", "Brazilian". */
  cuisine: string;
  hemisphere: Hemisphere;
  unitSystem: "metric" | "imperial";
  /** Example portion wording in the local idiom. */
  portionHint: string;
};

// ── Hemisphere ────────────────────────────────────────────────────────────────
// Only the exceptions are listed; anything unlisted is northern, which is where
// the great majority of the world's population lives.
const SOUTHERN = new Set([
  "AR", "AU", "BO", "BW", "CL", "FJ", "LS", "MG", "MW", "MZ", "NA", "NZ",
  "PY", "PG", "SZ", "TZ", "UY", "ZA", "ZM", "ZW", "AO", "BR", "PE",
]);
// Near the equator the four-season calendar is meaningless — these get wet/dry
// framing instead of being told it is "autumn".
const TROPICAL = new Set([
  "ID", "MY", "SG", "PH", "TH", "VN", "KH", "LA", "MM", "BN", "TL",
  "KE", "UG", "RW", "BI", "CD", "CG", "GA", "CM", "NG", "GH", "CI", "SN",
  "ET", "SO", "EC", "CO", "VE", "GY", "SR", "PA", "CR", "NI", "HN", "GT",
  "MV", "LK", "TT", "JM",
]);

function hemisphereFor(cc: string): Hemisphere {
  if (TROPICAL.has(cc)) return "tropical";
  return SOUTHERN.has(cc) ? "south" : "north";
}

// ── Cuisine ───────────────────────────────────────────────────────────────────
// The adjective an AI needs to pick dishes people actually eat. Unlisted
// countries fall back to naming the country itself, which reads fine in a
// prompt ("foods commonly eaten in Kenya") and never silently becomes Indian.
const CUISINE: Record<string, string> = {
  IN: "Indian", PK: "Pakistani", BD: "Bangladeshi", NP: "Nepali", LK: "Sri Lankan",
  US: "American", CA: "Canadian", GB: "British", IE: "Irish", AU: "Australian",
  NZ: "New Zealand", ZA: "South African", NG: "Nigerian", KE: "Kenyan",
  EG: "Egyptian", MA: "Moroccan", ET: "Ethiopian", GH: "Ghanaian", TZ: "Tanzanian",
  AE: "Emirati and South Asian", SA: "Saudi and Gulf", QA: "Gulf", KW: "Gulf",
  BH: "Gulf", OM: "Omani", IL: "Israeli", TR: "Turkish", IR: "Persian",
  DE: "German", FR: "French", IT: "Italian", ES: "Spanish", PT: "Portuguese",
  NL: "Dutch", BE: "Belgian", CH: "Swiss", AT: "Austrian", PL: "Polish",
  SE: "Swedish", NO: "Norwegian", DK: "Danish", FI: "Finnish", GR: "Greek",
  RU: "Russian", UA: "Ukrainian", RO: "Romanian", CZ: "Czech", HU: "Hungarian",
  CN: "Chinese", JP: "Japanese", KR: "Korean", TW: "Taiwanese", HK: "Cantonese",
  TH: "Thai", VN: "Vietnamese", ID: "Indonesian", MY: "Malaysian",
  SG: "Singaporean", PH: "Filipino",
  BR: "Brazilian", MX: "Mexican", AR: "Argentine", CL: "Chilean", CO: "Colombian",
  PE: "Peruvian",
};

// ── Portions ──────────────────────────────────────────────────────────────────
// Only where the local idiom differs enough to matter. The default is a metric
// wording that reads naturally almost anywhere.
const PORTION_HINT: Record<string, string> = {
  IN: "1 katori / 2 roti etc.",
  PK: "1 katori / 2 roti etc.",
  BD: "1 bati / 2 ruti etc.",
  NP: "1 bowl / 2 roti etc.",
  LK: "1 cup rice / 2 roti etc.",
  US: "1 cup / 1 slice / 4 oz etc.",
  GB: "1 bowl / 2 slices etc.",
  JP: "1 bowl (chawan) / 1 serving etc.",
  CN: "1 bowl / 1 serving etc.",
  MX: "2 tortillas / 1 taza etc.",
  BR: "1 prato / 1 concha etc.",
};
const DEFAULT_PORTION = "1 bowl (about 250 ml) / 100 g etc.";

// The three countries that have not adopted metric for everyday use.
const IMPERIAL = new Set(["US", "LR", "MM"]);

// The app's own supported languages, named the way the app names them; anything
// else falls through to Intl.
const APP_LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", bn: "Bengali", mr: "Marathi", te: "Telugu",
  ta: "Tamil", gu: "Gujarati", kn: "Kannada", ml: "Malayalam", pa: "Punjabi",
};

function displayName(code: string, type: "language" | "region", fallback: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type }).of(code);
    // Intl answers an unrecognised code with "Unknown Region" / "Unknown
    // Language", which would read as literal instruction in a prompt
    // ("foods commonly eaten in Unknown Region"). The raw code is worse
    // English but at least it is not a claim.
    if (!name || name.startsWith("Unknown")) return fallback;
    return name;
  } catch {
    // A Node build without full ICU would throw. The prompt still has to say
    // something, so it says the code.
    return fallback;
  }
}

export function resolveLocale(
  countryCode?: string | null,
  languageCode?: string | null,
): UserLocale {
  const cc = (countryCode || "IN").trim().toUpperCase();
  const lc = (languageCode || "en").trim().toLowerCase().split("-")[0];
  return {
    countryCode: cc,
    languageCode: lc,
    countryName: displayName(cc, "region", cc),
    languageName: APP_LANGUAGE_NAMES[lc] || displayName(lc, "language", lc),
    cuisine: CUISINE[cc] || `local, commonly eaten in ${displayName(cc, "region", cc)}`,
    hemisphere: hemisphereFor(cc),
    unitSystem: IMPERIAL.has(cc) ? "imperial" : "metric",
    portionHint: PORTION_HINT[cc] || DEFAULT_PORTION,
  };
}

// ── Season ────────────────────────────────────────────────────────────────────

// South Asia runs on a monsoon calendar, not a four-season one. These are the
// exact strings the Coach used before this module existed — India's prompt must
// not change.
const SOUTH_ASIA_SEASONS: Record<number, string> = {
  0: "Winter (Sardi) — Seasonal foods: Sarson saag, Gajar, Peas, Bajra, Tilgud",
  1: "Summer (Garmi) — Seasonal foods: Aam, Tarbuz, Aam Panna, Nimbu Paani, Coconut Water",
  2: "Monsoon (Barsaat) — Avoid raw salads. Prefer: Khichdi, Dahi, Ginger tea, Turmeric milk",
  3: "Autumn (Sharad) — Seasonal foods: Pomegranate, Guava, Apple, Light dal",
};
const SOUTH_ASIA = new Set(["IN", "PK", "BD", "NP", "BT"]);

const TEMPERATE_SEASONS = [
  "Winter — prefer warm, cooked, hearty foods and enough vitamin D",
  "Spring — fresh greens and lighter meals as the weather warms",
  "Summer — hot: prioritise hydration, fruit and lighter meals",
  "Autumn — cooling: root vegetables, squashes and warming spices",
];

/**
 * Season description for a user's country. `month` is 1-12; it defaults to the
 * current UTC month, which is the same month everywhere except for a few hours
 * either side of the date line — close enough for "what is in season".
 */
export function seasonFor(locale: UserLocale, month?: number): string {
  const m = month ?? new Date().getUTCMonth() + 1;

  if (SOUTH_ASIA.has(locale.countryCode)) {
    if ([12, 1, 2].includes(m)) return SOUTH_ASIA_SEASONS[0];
    if ([3, 4, 5].includes(m)) return SOUTH_ASIA_SEASONS[1];
    if ([6, 7, 8, 9].includes(m)) return SOUTH_ASIA_SEASONS[2];
    return SOUTH_ASIA_SEASONS[3];
  }

  if (locale.hemisphere === "tropical") {
    // No winter to speak of; what actually varies is rainfall, and the wet
    // months differ too much by country to guess, so say only what is true.
    return `Tropical climate (${locale.countryName}) — little seasonal temperature change. Prefer whatever produce is in season locally, and favour cooked over raw food during the rainy months`;
  }

  // Meteorological seasons: Dec-Feb winter in the north, and six months offset
  // in the south, so a July suggestion in Australia is a winter one.
  const northIndex = [12, 1, 2].includes(m) ? 0 : [3, 4, 5].includes(m) ? 1 : [6, 7, 8].includes(m) ? 2 : 3;
  const index = locale.hemisphere === "south" ? (northIndex + 2) % 4 : northIndex;
  return `${TEMPERATE_SEASONS[index]} (${locale.countryName})`;
}

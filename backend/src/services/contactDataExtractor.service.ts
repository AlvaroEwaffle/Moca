// Extract email and phone from message text
// Used for progressive lead enrichment in Fidelidapp integration

interface ExtractedContactData {
  emails: string[];
  phones: string[];
  businessNames: string[];
}

// Standard email pattern
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SINGLE_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Phone patterns: Chilean (+569...) and international formats (+1, +44, etc.)
// Also matches common formats without country code
const PHONE_REGEX = /(?:\+\d{1,3}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

// Minimum digits for a valid phone number (filters out short number matches)
const MIN_PHONE_DIGITS = 8;

const BUSINESS_NAME_PATTERNS = [
  /(?:mi\s+(?:negocio|empresa|marca|tienda|local|proyecto|emprendimiento)\s+(?:se\s+llama|es)\s+)([^.!?\n,;:]{2,80})/gi,
  /(?:nombre\s+del\s+(?:negocio|local|proyecto|emprendimiento)\s*(?:es|:)?\s*)([^.!?\n,;:]{2,80})/gi,
  /(?:my\s+(?:business|company|brand|store)\s+(?:is|called)\s+)([^.!?\n,;:]{2,80})/gi,
  /(?:business\s+name\s*(?:is|:)\s*)([^.!?\n,;:]{2,80})/gi,
];

const GENERIC_BUSINESS_NAMES = new Set([
  '',
  'business',
  'company',
  'empresa',
  'negocio',
  'local',
  'tienda',
  'mi negocio',
  'mi empresa',
  'mi tienda',
  'mi local',
  'no tengo',
  'ninguno',
  'ninguna',
  'no aplica',
  'no se',
  'n/a',
  'na',
  'si',
  'sí',
  'ok',
  'dale',
  'perfecto',
  'hola',
]);

const normalizeBusinessName = (value: string): string =>
  value
    .replace(/^[\s"'`({[\-]+/, '')
    .replace(/[\s"'`)}\]-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

export function hasMeaningfulBusinessName(value: string | undefined | null): boolean {
  const normalized = normalizeBusinessName(String(value || ''));
  if (!normalized) return false;
  if (SINGLE_EMAIL_REGEX.test(normalized)) return false;
  if (/https?:\/\//i.test(normalized)) return false;
  return !GENERIC_BUSINESS_NAMES.has(normalized.toLowerCase());
}

export function extractContactData(text: string): ExtractedContactData {
  const emails: string[] = [];
  const phones: string[] = [];
  const businessNames: string[] = [];

  if (!text) {
    return { emails, phones, businessNames };
  }

  // Extract emails
  const emailMatches = text.match(EMAIL_REGEX);
  if (emailMatches) {
    for (const email of emailMatches) {
      const normalized = email.toLowerCase().trim();
      if (!emails.includes(normalized)) {
        emails.push(normalized);
      }
    }
  }

  // Extract phones
  const phoneMatches = text.match(PHONE_REGEX);
  if (phoneMatches) {
    for (const phone of phoneMatches) {
      // Count actual digits to filter out short matches
      const digitCount = phone.replace(/\D/g, '').length;
      if (digitCount >= MIN_PHONE_DIGITS) {
        const normalized = phone.trim();
        if (!phones.includes(normalized)) {
          phones.push(normalized);
        }
      }
    }
  }

  for (const pattern of BUSINESS_NAME_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const candidate = normalizeBusinessName(match[1] || '');
      if (!hasMeaningfulBusinessName(candidate)) continue;

      const duplicate = businessNames.some(
        (businessName) => businessName.toLowerCase() === candidate.toLowerCase()
      );
      if (!duplicate) {
        businessNames.push(candidate);
      }
    }
  }

  return { emails, phones, businessNames };
}

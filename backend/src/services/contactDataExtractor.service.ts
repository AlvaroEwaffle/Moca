// Extract email and phone from message text
// Used for progressive lead enrichment in Fidelidapp integration

interface ExtractedContactData {
  emails: string[];
  phones: string[];
}

// Standard email pattern
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone patterns: Chilean (+569...) and international formats (+1, +44, etc.)
// Also matches common formats without country code
const PHONE_REGEX = /(?:\+\d{1,3}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

// Minimum digits for a valid phone number (filters out short number matches)
const MIN_PHONE_DIGITS = 8;

export function extractContactData(text: string): ExtractedContactData {
  const emails: string[] = [];
  const phones: string[] = [];

  if (!text) {
    return { emails, phones };
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

  return { emails, phones };
}

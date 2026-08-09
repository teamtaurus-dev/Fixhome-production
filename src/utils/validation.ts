/**
 * FixHome Name & Phone Validation Helpers
 */

/**
 * Validates that a full name contains only alphabets, spaces, dots, hyphens, and apostrophes,
 * and contains no numbers or digits.
 */
export function isValidName(name: string): boolean {
  const clean = name.trim();
  if (!clean || clean.length < 2) {
    return false;
  }
  // Disallow any digits 0-9
  if (/[0-9]/.test(clean)) {
    return false;
  }
  // Must consist only of letters (Latin/English), spaces, dots, hyphens, or apostrophes
  return /^[a-zA-Z\s\.\-']+$/.test(clean);
}

/**
 * Strips all digits and invalid characters from name inputs so users cannot type numbers in the name field.
 */
export function sanitizeNameInput(value: string): string {
  // Remove any numbers 0-9 and unwanted characters
  return value.replace(/[^a-zA-Z\s\.\-']/g, "");
}

/**
 * Validates whether a mobile phone number is a genuine 10-digit mobile number,
 * rejecting fake/dummy patterns like 1234567890, 9876543210, 1111111111, 12345678990, etc.
 */
export function isValidPhoneNumber(mobile: string): boolean {
  const clean = mobile.replace(/\D/g, "");

  // Must be exactly 10 digits
  if (clean.length !== 10) {
    return false;
  }

  // Standard mobile number prefix in India begins with 6, 7, 8, or 9
  if (!/^[6-9]/.test(clean)) {
    return false;
  }

  // Reject all same digits (e.g., 0000000000, 1111111111, 9999999999, 8888888888, etc.)
  if (/^(\d)\1{9}$/.test(clean)) {
    return false;
  }

  // Reject known dummy, test & sequence numbers
  const dummyNumbers = new Set([
    "1234567890",
    "0123456789",
    "9876543210",
    "0987654321",
    "1234512345",
    "1231231231",
    "9898989898",
    "1212121212",
    "9876598765",
    "9000000000",
    "9111111111",
    "9222222222",
    "9333333333",
    "9444444444",
    "9555555555",
    "9666666666",
    "9777777777",
    "9888888888",
    "9999999999",
    "8901234567",
    "7654321098"
  ]);

  if (dummyNumbers.has(clean)) {
    return false;
  }

  // Check for strict ascending sequence or descending sequence
  const isAscendingSequence = "01234567890123456789".includes(clean);
  const isDescendingSequence = "98765432109876543210".includes(clean);

  if (isAscendingSequence || isDescendingSequence) {
    return false;
  }

  return true;
}

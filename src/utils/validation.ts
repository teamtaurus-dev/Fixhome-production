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

/**
 * Payload Schema Guard & Sanitizer for Booking Creation Writes
 */
export function sanitizeBookingPayload(data: Record<string, any>): Record<string, any> {
  const sanitizedName = sanitizeNameInput(String(data.customer_name || "")).trim().substring(0, 100);
  const rawMobile = String(data.mobile_number || "").replace(/\D/g, "").substring(0, 10);
  const address = String(data.address || "").trim().substring(0, 300);
  const category = String(data.category_id || data.service_category || "electrical").trim().substring(0, 50);
  const serviceTitle = String(data.service_title || "").trim().substring(0, 150);
  const subService = String(data.sub_service || "").trim().substring(0, 150);
  const date = String(data.preferred_date || data.booking_date || "").trim().substring(0, 30);
  const time = String(data.preferred_time || data.time_slot || "").trim().substring(0, 30);
  const notes = String(data.notes || "").trim().substring(0, 500);

  if (!isValidName(sanitizedName)) {
    throw new Error("Invalid customer name. Only letters and standard characters allowed.");
  }

  if (!isValidPhoneNumber(rawMobile)) {
    throw new Error("Invalid 10-digit mobile number.");
  }

  if (!address || address.length < 5) {
    throw new Error("Address must be at least 5 characters long.");
  }

  return {
    customer_name: sanitizedName,
    mobile_number: rawMobile,
    address,
    category_id: category,
    service_title: serviceTitle || "General Service",
    sub_service: subService,
    preferred_date: date,
    preferred_time: time,
    notes,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Payload Sanitizer for Booking Status & Worker Updates
 */
export function sanitizeStatusUpdatePayload(status: string, extra: Record<string, any> = {}): Record<string, any> {
  const allowedStatuses = new Set(["pending", "assigned", "accepted", "in_progress", "completed", "cancelled"]);
  const cleanStatus = String(status || "").trim().toLowerCase();

  if (!allowedStatuses.has(cleanStatus)) {
    throw new Error(`Invalid status state: "${status}".`);
  }

  const payload: Record<string, any> = {
    status: cleanStatus,
    updated_at: new Date().toISOString()
  };

  if (extra.worker_id !== undefined) {
    payload.worker_id = String(extra.worker_id).trim().substring(0, 100);
  }
  if (extra.worker_name !== undefined) {
    payload.worker_name = sanitizeNameInput(String(extra.worker_name)).trim().substring(0, 100);
  }
  if (extra.worker_phone !== undefined) {
    payload.worker_phone = String(extra.worker_phone).replace(/\D/g, "").substring(0, 10);
  }
  if (extra.admin_notes !== undefined) {
    payload.admin_notes = String(extra.admin_notes).trim().substring(0, 500);
  }

  return payload;
}


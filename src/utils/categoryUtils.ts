export interface SubCategoryItem {
  name: string;
  minPrice: number;
  maxPrice: number;
  price: number; // Single value fallback (equals minPrice)
}

/**
 * Parses any string or object format into a structured SubCategoryItem { name, minPrice, maxPrice, price }
 * Supports strings like:
 * - "Tap Leakage & Repair - ₹199 - ₹299"
 * - "Tap Leakage & Repair - ₹199 to ₹299"
 * - "Tap Leakage & Repair - 199 - 299"
 * - "Tap Leakage & Repair - ₹199"
 * - "Tap Leakage & Repair (₹199 - ₹299)"
 * - { name: "Tap Leakage & Repair", minPrice: 199, maxPrice: 299 }
 */
export function parseSubcategoryItem(sub: any): SubCategoryItem {
  if (!sub) return { name: "", minPrice: 0, maxPrice: 0, price: 0 };
  
  if (typeof sub === "object" && sub !== null) {
    const name = String(sub.name || sub.title || "").trim();
    const minP = Number(sub.minPrice) || Number(sub.price) || Number(sub.cost) || 0;
    const maxP = Number(sub.maxPrice) || Number(sub.price) || Number(sub.cost) || minP;
    const minPrice = Math.min(minP, maxP);
    const maxPrice = Math.max(minP, maxP);
    return { name, minPrice, maxPrice, price: minPrice };
  }
  
  const str = String(sub).trim();
  if (!str) return { name: "", minPrice: 0, maxPrice: 0, price: 0 };

  // 1. Try matching price range pattern at the end: e.g. "Name - ₹199 - ₹299" or "Name (₹199 to ₹299)"
  const rangeMatch = str.match(/^(.*?)(?:[\s\-:(,]+(?:₹|Rs\.?|INR\s*)?(\d+)\s*(?:-|–|to|\.\.)\s*(?:₹|Rs\.?|INR\s*)?(\d+)\)?)?$/i);
  if (rangeMatch && rangeMatch[2] && rangeMatch[3]) {
    const namePart = rangeMatch[1].trim().replace(/[\-:(,]+$/, "").trim();
    const p1 = parseInt(rangeMatch[2], 10);
    const p2 = parseInt(rangeMatch[3], 10);
    const minPrice = Math.min(p1, p2);
    const maxPrice = Math.max(p1, p2);
    if (namePart) {
      return { name: namePart, minPrice, maxPrice, price: minPrice };
    }
  }

  // 2. Try matching single price pattern: e.g. "Name - ₹199"
  const singleMatch = str.match(/^(.*?)(?:[\s\-:(,]+(?:₹|Rs\.?|INR\s*)?(\d+)\)?)?$/i);
  if (singleMatch && singleMatch[2]) {
    const namePart = singleMatch[1].trim().replace(/[\-:(,]+$/, "").trim();
    const pricePart = parseInt(singleMatch[2], 10);
    if (namePart) {
      return { name: namePart, minPrice: pricePart, maxPrice: pricePart, price: pricePart };
    }
  }
  
  return { name: str, minPrice: 0, maxPrice: 0, price: 0 };
}

/**
 * Formats a subcategory item into a displayable object
 */
export function formatSubcategoryDisplay(sub: any): {
  name: string;
  minPrice: number;
  maxPrice: number;
  price: number;
  displayPrice: string;
  fullLabel: string;
} {
  const item = parseSubcategoryItem(sub);
  let displayPrice = "";
  if (item.minPrice > 0 && item.maxPrice > item.minPrice) {
    displayPrice = `₹${item.minPrice} - ₹${item.maxPrice}`;
  } else if (item.minPrice > 0) {
    displayPrice = `₹${item.minPrice}`;
  }

  const fullLabel = displayPrice ? `${item.name} - ${displayPrice}` : item.name;
  return { ...item, displayPrice, fullLabel };
}


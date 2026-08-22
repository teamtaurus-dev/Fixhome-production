import express from "express";
import path from "path";
import multer from "multer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  initDb,
  getDbStatus,
  getAdminByMobile,
  getCategories,
  addCategory,
  updateCategory,
  updateCategorySubcategories,
  deleteCategory,
  createBooking,
  getBookingById,
  getBookings,
  updateBookingStatus,
  purgeOldBookingsPII,
  purgeBookingPIIById,
  getWorkers,
  addWorker,
  updateWorker,
  deleteWorker,
  getOffers,
  addOffer,
  toggleOfferActive,
  deleteOffer,
  assignWorkerToBooking,
  getBookingsByMobile,
  saveUser,
  getUserByMobile,
  verifyUserLogin,
  getAllUsers
} from "./server/db.ts";
import { uploadMedia } from "./server/storage.ts";
import {
  getTelegramConfig,
  saveTelegramConfig,
  sendTelegramMessage,
  sendBookingTelegramNotification
} from "./server/telegram.ts";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "fix-home-jwt-secret-key-9938";

// Multer memory storage configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 31 * 1024 * 1024 // Set limit slightly higher so our custom 30MB validator handles it with nice custom errors
  }
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health & Database connection status endpoint
app.get("/api/health", (req, res) => {
  const dbStatus = getDbStatus();
  res.json({
    status: "ok",
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Serve Service Worker with explicit headers and no-cache policy
app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const swPath = path.join(process.cwd(), "public", "sw.js");
  if (fs.existsSync(swPath)) {
    res.sendFile(swPath);
  } else {
    res.status(404).type("application/javascript").send("// Service worker file not found");
  }
});

// Serve FCM Firebase Messaging Service Worker with explicit headers
app.get("/firebase-messaging-sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const fcmSwPath = path.join(process.cwd(), "public", "firebase-messaging-sw.js");
  if (fs.existsSync(fcmSwPath)) {
    res.sendFile(fcmSwPath);
  } else {
    res.status(404).type("application/javascript").send("// FCM Service worker file not found");
  }
});

// Registered FCM tokens store with role metadata
const registeredFCMTokens = new Map<string, { token: string; userId?: string; role: string; updatedAt: string }>();

// API: Register FCM Device Token
app.post("/api/notifications/register-token", (req, res) => {
  const { token, userId, role } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: "FCM token is required" });
  }

  registeredFCMTokens.set(token, {
    token,
    userId: userId || "anonymous",
    role: role || "customer",
    updatedAt: new Date().toISOString()
  });

  console.log(`[FCM] Registered device token for role '${role}' (Total: ${registeredFCMTokens.size}):`, token.substring(0, 15) + "...");
  res.json({ success: true, count: registeredFCMTokens.size });
});

// API: Send FCM Notification (Supports targetRole: 'admin' | 'customer' or specific token)
app.post("/api/notifications/send", async (req, res) => {
  const { token, targetRole, title, body, data } = req.body || {};
  const notifTitle = title || "FixHome Alert";
  const notifBody = body || "You have a new update from FixHome";

  let recipients = Array.from(registeredFCMTokens.values());
  if (token) {
    recipients = recipients.filter((r) => r.token === token);
  } else if (targetRole) {
    recipients = recipients.filter((r) => r.role === targetRole);
  }

  console.log(`[FCM Notification Send] Target Role: '${targetRole || "all"}', Recipients: ${recipients.length}, Title: "${notifTitle}", Body: "${notifBody}"`);

  res.json({
    success: true,
    message: `Notification broadcast queued for ${recipients.length} device(s)`,
    payload: { title: notifTitle, body: notifBody, data: data || {} },
    recipientCount: recipients.length
  });
});

// Serve uploads folder statically if in fallback mode
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use("/uploads", express.static(UPLOADS_DIR));

// ADMIN JWT AUTH MIDDLEWARE
function authenticateAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. Admin authorization token missing." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; mobile_number: string };
    (req as any).admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

// ==================== API ENDPOINTS ====================

// 1. ADMIN GATEWAY: Login Form Auth
app.post("/api/admin/login", async (req, res) => {
  let { mobile_number, password } = req.body;

  if (!mobile_number || !password) {
    return res.status(400).json({ error: "Mobile number and password are required." });
  }

  mobile_number = String(mobile_number).trim();
  password = String(password).trim();

  try {
    const admin = await getAdminByMobile(mobile_number);
    if (!admin) {
      return res.status(401).json({ error: "Invalid mobile number or administrative password." });
    }

    // Verify bcrypt hash
    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid mobile number or administrative password." });
    }

    // Sign JWT token - Admin session remains persistently active
    const token = jwt.sign(
      { id: admin.id, mobile_number: admin.mobile_number },
      JWT_SECRET,
      { expiresIn: "365d" }
    );

    res.json({
      success: true,
      token,
      admin: {
        mobile_number: admin.mobile_number
      }
    });
  } catch (err: any) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Server authentication error." });
  }
});

// 2. PUBLIC: Get Active Service Categories
app.get("/api/categories", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Could not retrieve service categories." });
  }
});

// 3. ADMIN-ONLY: Add Service Category (with 30MB Image upload)
app.post("/api/categories", authenticateAdmin, upload.single("image"), async (req, res) => {
  const { name, description } = req.body;
  const file = req.file;

  if (!name || !description) {
    return res.status(400).json({ error: "Service Name and Description are required." });
  }

  if (!file) {
    return res.status(400).json({ error: "An image file is required for new service categories." });
  }

  // CRITICAL 30MB IMAGE VALIDATION GUARDRAIL
  const THIRTY_MB = 30 * 1024 * 1024;
  if (file.size > THIRTY_MB) {
    // 400 Bad Request utilizing Coral highlight color template standard
    return res.status(400).json({
      error: "CRITICAL LIMIT EXCEEDED: Upload blocked! The selected file exceeds the 30MB limit limit.",
      limit_error: true
    });
  }

  try {
    // Upload image to Replit Object Storage / Local fallback
    const imageUrl = await uploadMedia(file.buffer, file.originalname, file.mimetype);

    // Parse subcategories if provided
    let parsedSubcats: string[] = [];
    if (req.body.subcategories) {
      if (Array.isArray(req.body.subcategories)) {
        parsedSubcats = req.body.subcategories;
      } else if (typeof req.body.subcategories === "string") {
        try {
          parsedSubcats = JSON.parse(req.body.subcategories);
        } catch (e) {
          parsedSubcats = req.body.subcategories.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      }
    }

    // Save to PostgreSQL / JSON DB
    const newCategory = await addCategory(name, description, imageUrl, parsedSubcats);
    res.status(201).json({ success: true, category: newCategory });
  } catch (err: any) {
    console.error("Error saving service category:", err);
    res.status(500).json({ error: err.message || "Could not save service category." });
  }
});

// 3.5 ADMIN-ONLY: Edit / Update Service Category (Name, Description, Image, Subcategories)
app.put("/api/categories/:id", authenticateAdmin, upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const { name, description, image_url } = req.body;
  const file = req.file;

  try {
    let finalImageUrl = image_url;
    if (file) {
      const THIRTY_MB = 30 * 1024 * 1024;
      if (file.size > THIRTY_MB) {
        return res.status(400).json({
          error: "CRITICAL LIMIT EXCEEDED: Upload blocked! The selected file exceeds 30MB.",
          limit_error: true
        });
      }
      finalImageUrl = await uploadMedia(file.buffer, file.originalname, file.mimetype);
    }

    let parsedSubcats: string[] | undefined = undefined;
    if (req.body.subcategories !== undefined) {
      if (Array.isArray(req.body.subcategories)) {
        parsedSubcats = req.body.subcategories;
      } else if (typeof req.body.subcategories === "string") {
        try {
          parsedSubcats = JSON.parse(req.body.subcategories);
        } catch (e) {
          parsedSubcats = req.body.subcategories.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      }
    }

    const updatedCategory = await updateCategory(id, {
      name: name ? name.trim() : undefined,
      description: description ? description.trim() : undefined,
      imageUrl: finalImageUrl,
      subcategories: parsedSubcats
    });

    if (updatedCategory) {
      res.json({ success: true, category: updatedCategory, message: "Service category updated successfully." });
    } else {
      res.status(404).json({ error: "Service category not found." });
    }
  } catch (err: any) {
    console.error("Error updating category:", err);
    res.status(500).json({ error: err.message || "Could not update service category." });
  }
});

// 3.6 ADMIN-ONLY: Manage/Update Subcategories for a Category
app.put("/api/categories/:id/subcategories", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  let { subcategories } = req.body;

  if (!Array.isArray(subcategories)) {
    if (typeof subcategories === "string") {
      try {
        subcategories = JSON.parse(subcategories);
      } catch (e) {
        subcategories = subcategories.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    } else {
      subcategories = [];
    }
  }

  try {
    const updatedCategory = await updateCategorySubcategories(id, subcategories);
    if (updatedCategory) {
      res.json({ success: true, category: updatedCategory, message: "Subcategories updated successfully." });
    } else {
      res.status(404).json({ error: "Service category not found." });
    }
  } catch (err: any) {
    console.error("Error updating category subcategories:", err);
    res.status(500).json({ error: "Could not update service category subcategories." });
  }
});

// 4. ADMIN-ONLY: Delete Service Category
app.delete("/api/categories/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const success = await deleteCategory(id);
    if (success) {
      res.json({ success: true, message: "Category deleted successfully." });
    } else {
      res.status(404).json({ error: "Service category not found in the database." });
    }
  } catch (err: any) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: `Could not delete category: ${err.message || err}` });
  }
});

// 5. PUBLIC: Submit Booking Form
app.post("/api/bookings", async (req, res) => {
  const {
    service_type,
    mobile_number,
    address,
    latitude,
    longitude,
    google_maps_url,
    landmark,
    additional_notes
  } = req.body;

  if (!service_type || !mobile_number || !address) {
    return res.status(400).json({ error: "Service, phone number, and physical address are required." });
  }

  try {
    const parsedLat = latitude != null ? parseFloat(latitude) : null;
    const parsedLng = longitude != null ? parseFloat(longitude) : null;
    const computedMapsUrl = (parsedLat != null && parsedLng != null)
      ? `https://maps.google.com/?q=${parsedLat},${parsedLng}`
      : (address && address.trim())
        ? `https://maps.google.com/?q=${encodeURIComponent(address.trim())}`
        : (google_maps_url || null);

    const booking = await createBooking({
      service_type,
      mobile_number,
      address,
      latitude: parsedLat,
      longitude: parsedLng,
      google_maps_url: computedMapsUrl,
      landmark,
      additional_notes
    });

    // Fire Telegram Instant Alert asynchronously in background (non-blocking)
    sendBookingTelegramNotification(booking)
      .then((tgResult) => {
        if (tgResult.success) {
          console.log(`[Telegram Notification Sent] Alert dispatched successfully for booking ${booking.request_id}`);
        } else {
          console.warn(`[Telegram Notification Warning] Could not send alert: ${tgResult.error}`);
        }
      })
      .catch((err) => {
        console.error("[Telegram] Async notification error:", err);
      });

    // Return HTTP response IMMEDIATELY so the client UI updates without lag
    res.status(201).json({
      success: true,
      request_id: booking.request_id,
      message: "our agent will contact you in a while",
      booking
    });
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({ error: "Could not complete booking submission." });
  }
});

// PUBLIC: Fallback or Direct Trigger for Telegram Notification
app.post("/api/public/telegram-notify", async (req, res) => {
  const { booking } = req.body || {};
  if (!booking) {
    return res.status(400).json({ error: "Booking object is required" });
  }

  try {
    const result = await sendBookingTelegramNotification(booking);
    if (result.success) {
      res.json({ success: true, message: "Telegram notification sent successfully." });
    } else {
      res.status(400).json({ error: result.error || "Failed to send Telegram notification." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error sending Telegram notification." });
  }
});

// 5.5 PUBLIC: Get Single Booking Progress / Status for Customer Live Tracking
app.get("/api/bookings/track/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const booking = await getBookingById(id);
    if (!booking) {
      return res.status(404).json({ error: "Booking request not found or expired." });
    }
    res.json({ success: true, booking });
  } catch (err) {
    console.error("Error tracking booking:", err);
    res.status(500).json({ error: "Could not fetch booking tracking status." });
  }
});

// 5.6 PUBLIC: Get User Booking History by Mobile Number
app.get("/api/bookings/user/:mobile", async (req, res) => {
  const { mobile } = req.params;
  if (!mobile || !mobile.trim()) {
    return res.status(400).json({ error: "Mobile number is required." });
  }
  try {
    const userBookings = await getBookingsByMobile(mobile);
    res.json({ success: true, bookings: userBookings });
  } catch (err) {
    console.error("Error fetching user bookings history:", err);
    res.status(500).json({ error: "Could not fetch user booking history." });
  }
});

// 6. ADMIN-ONLY: Get All Bookings
app.get("/api/bookings", authenticateAdmin, async (req, res) => {
  try {
    const bookings = await getBookings();
    res.json(bookings);
  } catch (err) {
    console.error("Error retrieving bookings:", err);
    res.status(500).json({ error: "Could not retrieve bookings." });
  }
});

// 6.5 ADMIN-ONLY: Assign Worker to Booking
app.post("/api/bookings/:id/assign-worker", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { worker_id } = req.body;
  try {
    const updated = await assignWorkerToBooking(id, worker_id || null);
    if (updated) {
      res.json({ success: true, booking: updated });
    } else {
      res.status(404).json({ error: "Booking request not found." });
    }
  } catch (err) {
    console.error("Error assigning worker to booking:", err);
    res.status(500).json({ error: "Could not assign worker to booking." });
  }
});

// 7. ADMIN-ONLY: Update Booking Status
app.put("/api/bookings/:id/status", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["Pending", "Assigned", "In Progress", "Completed"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid booking status. Must be Pending, Assigned, In Progress, or Completed." });
  }

  try {
    const updated = await updateBookingStatus(id, status as any);
    if (updated) {
      res.json({ success: true, booking: updated });
    } else {
      res.status(404).json({ error: "Booking request not found." });
    }
  } catch (err) {
    console.error("Error updating booking status:", err);
    res.status(500).json({ error: "Could not update booking status." });
  }
});

// ==================== WORKERS MANAGEMENT ENDPOINTS ====================
app.get("/api/workers", async (req, res) => {
  try {
    const workers = await getWorkers();
    res.json(workers);
  } catch (err) {
    console.error("Error fetching workers:", err);
    res.status(500).json({ error: "Could not fetch workers." });
  }
});

app.post("/api/workers", authenticateAdmin, upload.single("photo"), async (req, res) => {
  const { name, phone_number, category, photo_url } = req.body;
  if (!name || !phone_number || !category) {
    return res.status(400).json({ error: "Worker name, phone number, and service category are required." });
  }
  try {
    let finalPhotoUrl = photo_url;
    if (req.file) {
      finalPhotoUrl = await uploadMedia(req.file.buffer, req.file.originalname, req.file.mimetype);
    }
    const newWorker = await addWorker(
      name,
      phone_number,
      category,
      finalPhotoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80"
    );
    res.status(201).json({ success: true, worker: newWorker });
  } catch (err) {
    console.error("Error creating worker:", err);
    res.status(500).json({ error: "Could not create worker." });
  }
});

app.put("/api/workers/:id", authenticateAdmin, upload.single("photo"), async (req, res) => {
  const { id } = req.params;
  const { name, phone_number, category, photo_url } = req.body;

  try {
    let finalPhotoUrl = photo_url;
    if (req.file) {
      finalPhotoUrl = await uploadMedia(req.file.buffer, req.file.originalname, req.file.mimetype);
    }

    const updatedWorker = await updateWorker(id, {
      name,
      phoneNumber: phone_number,
      category,
      photoUrl: finalPhotoUrl
    });

    if (updatedWorker) {
      res.json({ success: true, worker: updatedWorker, message: "Worker updated successfully." });
    } else {
      res.status(404).json({ error: "Worker not found." });
    }
  } catch (err: any) {
    console.error("Error updating worker:", err);
    res.status(500).json({ error: "Could not update worker details." });
  }
});

app.delete("/api/workers/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const success = await deleteWorker(id);
    if (success) {
      res.json({ success: true, message: "Worker deleted successfully." });
    } else {
      res.status(404).json({ error: "Worker not found." });
    }
  } catch (err) {
    console.error("Error deleting worker:", err);
    res.status(500).json({ error: "Could not delete worker." });
  }
});

// ==================== OFFERS MANAGEMENT ENDPOINTS ====================
app.get("/api/offers", async (req, res) => {
  try {
    const offers = await getOffers();
    res.json(offers);
  } catch (err) {
    console.error("Error fetching offers:", err);
    res.status(500).json({ error: "Could not fetch offers." });
  }
});

app.post("/api/offers", authenticateAdmin, async (req, res) => {
  const { title, description, discount_percentage, discount_type, discount_value, is_festival_offer, min_bookings_required, code } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: "Title and description are required." });
  }
  try {
    const val = Number(discount_value !== undefined ? discount_value : (discount_percentage || 10));
    const newOffer = await addOffer({
      title,
      description,
      discount_percentage: val,
      discount_type: discount_type || "percent",
      discount_value: val,
      is_festival_offer: Boolean(is_festival_offer),
      min_bookings_required: Number(min_bookings_required || 0),
      code,
      is_active: true
    });
    res.status(201).json({ success: true, offer: newOffer });
  } catch (err) {
    console.error("Error creating offer:", err);
    res.status(500).json({ error: "Could not create offer." });
  }
});

app.put("/api/offers/:id/toggle", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    const updated = await toggleOfferActive(id, Boolean(is_active));
    if (updated) {
      res.json({ success: true, offer: updated });
    } else {
      res.status(404).json({ error: "Offer not found." });
    }
  } catch (err) {
    console.error("Error toggling offer state:", err);
    res.status(500).json({ error: "Could not toggle offer status." });
  }
});

app.delete("/api/offers/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const success = await deleteOffer(id);
    if (success) {
      res.json({ success: true, message: "Offer deleted successfully." });
    } else {
      res.status(404).json({ error: "Offer not found." });
    }
  } catch (err) {
    console.error("Error deleting offer:", err);
    res.status(500).json({ error: "Could not delete offer." });
  }
});

// 8. ADMIN-ONLY: Delete Customer User Details (PII) for a Specific Booking
app.delete("/api/bookings/:id/pii", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await purgeBookingPIIById(id);
    if (updated) {
      res.json({
        success: true,
        message: "Customer details deleted. Service record retained.",
        booking: updated
      });
    } else {
      res.status(404).json({ error: "Booking request not found." });
    }
  } catch (err) {
    console.error("Error deleting customer user details:", err);
    res.status(500).json({ error: "Could not delete customer details." });
  }
});

// Force immediate purge execution for debugging
app.post("/api/admin/purge-pii", authenticateAdmin, async (req, res) => {
  try {
    const count = await purgeOldBookingsPII();
    res.json({ success: true, purged_count: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to purge PII." });
  }
});

// ==================== USER REGISTRATION & PROFILE ENDPOINTS ====================

function isValidServerPhone(mobile: string): boolean {
  const clean = mobile.replace(/\D/g, "");
  if (clean.length !== 10) return false;
  if (!/^[6-9]/.test(clean)) return false;
  if (/^(\d)\1{9}$/.test(clean)) return false;
  const dummy = new Set([
    "1234567890", "0123456789", "9876543210", "0987654321",
    "1234512345", "1231231231", "9898989898", "1212121212",
    "9000000000", "9111111111", "9876598765"
  ]);
  if (dummy.has(clean)) return false;
  if ("01234567890123456789".includes(clean) || "98765432109876543210".includes(clean)) return false;
  return true;
}

function isValidServerName(name: string): boolean {
  const clean = name.trim();
  if (!clean || clean.length < 2) return false;
  if (/[0-9]/.test(clean)) return false;
  return /^[a-zA-Z\s\.\-']+$/.test(clean);
}

// 1. Register or update user details permanently in database with password
app.get("/api/users/register", (req, res) => {
  res.json({ success: true, message: "FixHome User Registration API active. Use POST to register." });
});

app.post("/api/users/register", async (req, res) => {
  const { name, mobile_number, password } = req.body;
  if (!name || !mobile_number) {
    return res.status(400).json({ error: "Name and mobile number are required." });
  }

  const cleanName = String(name).trim();
  const cleanMobile = String(mobile_number).trim();

  if (!isValidServerName(cleanName)) {
    return res.status(400).json({ error: "Please enter a valid full name using alphabets only." });
  }

  if (!isValidServerPhone(cleanMobile)) {
    return res.status(400).json({ error: "please enter a valid phone number" });
  }

  if (password && String(password).length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }

  try {
    const user = await saveUser(cleanName, cleanMobile, password);
    const safeUser = { ...user };
    delete safeUser.password_hash;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error("Error registering user:", err);
    res.status(500).json({ error: "Failed to save user details in database." });
  }
});

// 2. Customer login with mobile number & password
app.post("/api/users/login", async (req, res) => {
  const { mobile_number, password } = req.body;
  if (!mobile_number || !password) {
    return res.status(400).json({ error: "Mobile number and password are required." });
  }

  const cleanMobile = String(mobile_number).trim();
  if (!/^\d{10}$/.test(cleanMobile)) {
    return res.status(400).json({ error: "Please enter a valid 10-digit mobile number." });
  }

  try {
    const result = await verifyUserLogin(cleanMobile, String(password));
    if (!result.success || !result.user) {
      return res.status(401).json({ error: result.message || "Login failed." });
    }
    const safeUser = { ...result.user };
    delete safeUser.password_hash;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error("Error logging in user:", err);
    res.status(500).json({ error: "Failed to log in user." });
  }
});

// 3. Fetch user profile by mobile number
app.get("/api/users/:mobile", async (req, res) => {
  const { mobile } = req.params;
  try {
    const user = await getUserByMobile(mobile);
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }
    const safeUser = { ...user };
    delete safeUser.password_hash;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user details." });
  }
});

// 4. Admin view: Fetch all registered users
app.get("/api/admin/users", authenticateAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    const safeUsers = users.map((u) => {
      const copy = { ...u };
      delete copy.password_hash;
      return copy;
    });
    res.json({ success: true, users: safeUsers });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users list." });
  }
});

// ==================== TELEGRAM NOTIFICATION ADMIN ENDPOINTS ====================

// GET: Retrieve Telegram configuration status
app.get("/api/admin/telegram-config", (req, res) => {
  const config = getTelegramConfig();
  res.json({
    success: true,
    botToken: config.botToken ? `${config.botToken.substring(0, 8)}...${config.botToken.slice(-4)}` : "",
    hasBotToken: Boolean(config.botToken),
    chatId: config.chatId,
    enabled: config.enabled
  });
});

// POST: Save Telegram configuration (Bot Token, Chat ID, Enabled toggle)
app.post("/api/admin/telegram-config", (req, res) => {
  const { botToken, chatId, enabled } = req.body;
  if (botToken === undefined && chatId === undefined && enabled === undefined) {
    return res.status(400).json({ error: "No Telegram settings provided." });
  }

  const updated = saveTelegramConfig({
    botToken,
    chatId,
    enabled
  });

  res.json({
    success: true,
    message: "Telegram notification settings saved successfully.",
    enabled: updated.enabled,
    chatId: updated.chatId,
    hasBotToken: Boolean(updated.botToken)
  });
});

// POST: Send test notification message to Telegram
app.post("/api/admin/telegram-test", async (req, res) => {
  const { botToken, chatId } = req.body;
  const config = getTelegramConfig();
  const tokenToUse = (botToken && botToken.trim()) ? botToken.trim() : config.botToken;
  const chatIdToUse = (chatId && chatId.trim()) ? chatId.trim() : config.chatId;

  if (!tokenToUse || !chatIdToUse) {
    return res.status(400).json({ error: "Both Bot Token and Chat ID are required to send a test message. Please enter and save credentials first." });
  }

  const testMessage = `🤖 <b>FIXHOME TELEGRAM TEST NOTIFICATION</b>\n\n✅ Your Telegram Bot integration is working perfectly!\n\nYou will receive instant notifications whenever a customer books a service on FixHome.\n\n<i>Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</i>`;

  const result = await sendTelegramMessage(testMessage, tokenToUse, chatIdToUse);

  if (result.success) {
    res.json({ success: true, message: "Test alert sent successfully! Check your Telegram chat." });
  } else {
    res.status(400).json({ error: result.error || "Failed to send test message to Telegram." });
  }
});



// ==================== ASYNC BOOT & ROUTING INTERFACES ====================

async function startServer() {
  // 1. Initialize the Database tables and Seed default admin credentials
  try {
    await initDb();
    console.log("Database initialized successfully!");
  } catch (err) {
    console.error("Database initialization failed during bootstrap:", err);
  }

  // 2. Start automatic 6-hour PII data retention policy timer
  purgeOldBookingsPII().catch((err) => console.error("Initial PII purge check error:", err));
  setInterval(() => {
    purgeOldBookingsPII().catch((err) => console.error("Interval PII purge check error:", err));
  }, 60000); // Continuous 60s background check
  console.log("Auto PII Purge active: Customer details (phone & location) deleted after 6 hours. Service records retained.");

  // 3. Setup Vite development middlewares OR build folder serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Mounted Vite development middleware");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Immutable cache for Vite hashed assets
    app.use("/assets", express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
      fallthrough: false
    }));

    // Service workers and manifest must never be cached long term
    app.get(["/sw.js", "/firebase-messaging-sw.js", "/manifest.json"], (req, res, next) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      next();
    });

    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));

    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static assets from dist/ with proper Cache-Control headers");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`FixHome Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

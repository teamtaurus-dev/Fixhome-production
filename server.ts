import express from "express";
import path from "path";
import multer from "multer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import {
  initDb,
  getAdminByMobile,
  getCategories,
  addCategory,
  deleteCategory,
  createBooking,
  getBookings,
  updateBookingStatus,
  purgeOldBookingsPII
} from "./server/db.ts";
import { uploadMedia } from "./server/storage.ts";

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

app.use(express.json());

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
  const { mobile_number, password } = req.body;

  if (!mobile_number || !password) {
    return res.status(400).json({ error: "Mobile number and password are required." });
  }

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

    // Sign JWT token - Admin session valid
    const token = jwt.sign(
      { id: admin.id, mobile_number: admin.mobile_number },
      JWT_SECRET,
      { expiresIn: "1h" } // Session token expires in 1 hour (frontend activity will revoke after 15 min of idle)
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

    // Save to PostgreSQL / JSON DB
    const newCategory = await addCategory(name, description, imageUrl);
    res.status(201).json({ success: true, category: newCategory });
  } catch (err: any) {
    console.error("Error saving service category:", err);
    res.status(500).json({ error: err.message || "Could not save service category." });
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
    landmark,
    additional_notes
  } = req.body;

  if (!service_type || !mobile_number || !address) {
    return res.status(400).json({ error: "Service, phone number, and physical address are required." });
  }

  try {
    const booking = await createBooking({
      service_type,
      mobile_number,
      address,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      landmark,
      additional_notes
    });

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

// Force immediate purge execution for debugging
app.post("/api/admin/purge-pii", authenticateAdmin, async (req, res) => {
  try {
    const count = await purgeOldBookingsPII();
    res.json({ success: true, purged_count: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to purge PII." });
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

  // 2. Set up the 6-Hour Background Data Purging cron loop (Runs every 5 minutes)
  setInterval(async () => {
    try {
      console.log("[Background Chrono Task] Scanning for customer PII over 6 hours old...");
      await purgeOldBookingsPII();
    } catch (err) {
      console.error("[Background Task Error] Failed during database PII purge interval:", err);
    }
  }, 5 * 60 * 1000); // 5 minutes

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
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production static assets from dist/");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Fix home Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

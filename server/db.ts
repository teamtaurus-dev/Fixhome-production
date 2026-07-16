import pg from "pg";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

// Define TypeScript interfaces for our entities
export interface Admin {
  id: string;
  mobile_number: string;
  password_hash: string;
  created_at: Date;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: Date;
}

export interface Booking {
  request_id: string;
  service_type: string;
  mobile_number: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  landmark: string | null;
  additional_notes: string | null;
  status: "Pending" | "Assigned" | "In Progress" | "Completed";
  is_personal_data_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

const DATABASE_URL = process.env.DATABASE_URL;
let pool: pg.Pool | null = null;
const isPostgres = !!DATABASE_URL;

// Path to JSON database for fallback or if PostgreSQL is not active
const JSON_DB_PATH = path.join(process.cwd(), "database.json");

// Helper to generate UUIDs if we are in JSON fallback mode
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// In-memory/JSON store structure
interface JsonDatabase {
  admins: Admin[];
  categories: Category[];
  bookings: Booking[];
}

// Read JSON database
function readJsonDb(): JsonDatabase {
  if (!fs.existsSync(JSON_DB_PATH)) {
    const initialDb: JsonDatabase = { admins: [], categories: [], bookings: [] };
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(initialDb, null, 2), "utf8");
    return initialDb;
  }
  try {
    const content = fs.readFileSync(JSON_DB_PATH, "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading JSON database, resetting", err);
    return { admins: [], categories: [], bookings: [] };
  }
}

// Write JSON database
function writeJsonDb(db: JsonDatabase) {
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

// Initialize the database tables
export async function initDb() {
  const adminMobile = "9849758018";
  const rawAdminPassword = "mammu@143";
  const passwordHash = bcrypt.hashSync(rawAdminPassword, 10);

  if (isPostgres) {
    console.log("Database Mode: PostgreSQL (Replit Native or Cloud SQL)");
    try {
      pool = new pg.Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      });

      // Create admin table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mobile_number VARCHAR(20) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create categories table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          image_url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create bookings table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          service_type VARCHAR(100) NOT NULL,
          mobile_number VARCHAR(20),
          address TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          landmark TEXT,
          additional_notes TEXT,
          status VARCHAR(50) DEFAULT 'Pending' NOT NULL,
          is_personal_data_deleted BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed the single administrator if not exists
      const checkAdmin = await pool.query("SELECT * FROM admin WHERE mobile_number = $1", [adminMobile]);
      if (checkAdmin.rowCount === 0) {
        await pool.query(
          "INSERT INTO admin (mobile_number, password_hash) VALUES ($1, $2)",
          [adminMobile, passwordHash]
        );
        console.log("Successfully seeded admin user in PostgreSQL");
      }

      // Seed default service categories if table is empty
      const checkCats = await pool.query("SELECT * FROM categories LIMIT 1");
      if (checkCats.rowCount === 0) {
        const defaultCats = [
          { name: "Electrical Repairs", desc: "Expert troubleshooting, wiring, socket replacement, and lighting repairs.", url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=600&auto=format&fit=crop" },
          { name: "Plumbing Services", desc: "Leaking pipes, tap repair, blockage removals, and full bathroom diagnostics.", url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=600&auto=format&fit=crop" },
          { name: "Carpentry & Joinery", desc: "Door adjustments, furniture assembly, shelf installations, and wood polishing.", url: "https://images.unsplash.com/photo-1534224039826-c7a0dea0e66a?q=80&w=600&auto=format&fit=crop" }
        ];
        for (const cat of defaultCats) {
          await pool.query(
            "INSERT INTO categories (name, description, image_url) VALUES ($1, $2, $3)",
            [cat.name, cat.desc, cat.url]
          );
        }
        console.log("Seeded default service categories in PostgreSQL");
      }

      console.log("Database initialized successfully!");
      return;
    } catch (err) {
      console.error("PostgreSQL Pool initialization failed, falling back to JSON database:", err);
      pool = null;
    }
  }

  // Fallback to JSON database
  console.log("Database Mode: JSON File Fallback");
  const db = readJsonDb();
  
  // Ensure seed admin exists
  const hasAdmin = db.admins.some((a) => a.mobile_number === adminMobile);
  if (!hasAdmin) {
    db.admins.push({
      id: generateUUID(),
      mobile_number: adminMobile,
      password_hash: passwordHash,
      created_at: new Date()
    });
    writeJsonDb(db);
    console.log("Successfully seeded admin user in JSON Database");
  }

  // Ensure default service categories exist
  if (db.categories.length === 0) {
    const defaultCats = [
      { name: "Electrical Repairs", desc: "Expert troubleshooting, wiring, socket replacement, and lighting repairs.", url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=600&auto=format&fit=crop" },
      { name: "Plumbing Services", desc: "Leaking pipes, tap repair, blockage removals, and full bathroom diagnostics.", url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=600&auto=format&fit=crop" },
      { name: "Carpentry & Joinery", desc: "Door adjustments, furniture assembly, shelf installations, and wood polishing.", url: "https://images.unsplash.com/photo-1534224039826-c7a0dea0e66a?q=80&w=600&auto=format&fit=crop" }
    ];
    for (const cat of defaultCats) {
      db.categories.push({
        id: generateUUID(),
        name: cat.name,
        description: cat.desc,
        image_url: cat.url,
        created_at: new Date()
      });
    }
    writeJsonDb(db);
    console.log("Seeded default service categories in JSON Database");
  }
}

// Core Admin Queries
export async function getAdminByMobile(mobileNumber: string): Promise<Admin | null> {
  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM admin WHERE mobile_number = $1", [mobileNumber]);
      if (res.rowCount && res.rowCount > 0) {
        return res.rows[0];
      }
      return null;
    } catch (err) {
      console.error("Error querying admin in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  return db.admins.find((a) => a.mobile_number === mobileNumber) || null;
}

// Categories CRUD Operations
export async function getCategories(): Promise<Category[]> {
  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM categories ORDER BY created_at DESC");
      return res.rows;
    } catch (err) {
      console.error("Error querying categories in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  return [...db.categories].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addCategory(name: string, description: string, imageUrl: string): Promise<Category> {
  if (pool) {
    try {
      const res = await pool.query(
        "INSERT INTO categories (name, description, image_url) VALUES ($1, $2, $3) RETURNING *",
        [name, description, imageUrl]
      );
      return res.rows[0];
    } catch (err) {
      console.error("Error inserting category in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  const newCat: Category = {
    id: generateUUID(),
    name,
    description,
    image_url: imageUrl,
    created_at: new Date()
  };
  db.categories.push(newCat);
  writeJsonDb(db);
  return newCat;
}

export async function deleteCategory(id: string): Promise<boolean> {
  if (pool) {
    try {
      const res = await pool.query("DELETE FROM categories WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error("Error deleting category in PostgreSQL:", err);
      throw err;
    }
  }
  const db = readJsonDb();
  const originalLength = db.categories.length;
  db.categories = db.categories.filter((cat) => cat.id !== id);
  if (db.categories.length < originalLength) {
    writeJsonDb(db);
    return true;
  }
  return false;
}

// Bookings CRUD Operations
export async function createBooking(data: {
  service_type: string;
  mobile_number: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  landmark?: string;
  additional_notes?: string;
}): Promise<Booking> {
  if (pool) {
    try {
      const res = await pool.query(
        `INSERT INTO bookings (service_type, mobile_number, address, latitude, longitude, landmark, additional_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          data.service_type,
          data.mobile_number,
          data.address,
          data.latitude,
          data.longitude,
          data.landmark || null,
          data.additional_notes || null
        ]
      );
      return res.rows[0];
    } catch (err) {
      console.error("Error inserting booking in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  const newBooking: Booking = {
    request_id: generateUUID(),
    service_type: data.service_type,
    mobile_number: data.mobile_number,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    landmark: data.landmark || null,
    additional_notes: data.additional_notes || null,
    status: "Pending",
    is_personal_data_deleted: false,
    created_at: new Date(),
    updated_at: new Date()
  };
  db.bookings.push(newBooking);
  writeJsonDb(db);
  return newBooking;
}

export async function getBookings(): Promise<Booking[]> {
  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM bookings ORDER BY created_at DESC");
      return res.rows;
    } catch (err) {
      console.error("Error querying bookings in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  return [...db.bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function updateBookingStatus(requestId: string, status: "Pending" | "Assigned" | "In Progress" | "Completed"): Promise<Booking | null> {
  if (pool) {
    try {
      const res = await pool.query(
        "UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE request_id = $2 RETURNING *",
        [status, requestId]
      );
      if (res.rowCount && res.rowCount > 0) {
        return res.rows[0];
      }
      return null;
    } catch (err) {
      console.error("Error updating booking status in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  const booking = db.bookings.find((b) => b.request_id === requestId);
  if (booking) {
    booking.status = status;
    booking.updated_at = new Date();
    writeJsonDb(db);
    return booking;
  }
  return null;
}

// 6-HOUR DATA RETENTION POLICY
// "Enforce a background task handler or database trigger targeting the local PostgreSQL database to purge individual customer PII precisely 6 hours post-submission.
// - Columns to completely CRUSH/SET TO NULL: mobile_number, address, latitude, longitude, landmark, additional_notes.
// - Columns to RETAIN for historical operational metrics: request_id, service_type, status, created_at, updated_at. Explicitly flip the flag is_personal_data_deleted = true."
export async function purgeOldBookingsPII(): Promise<number> {
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  let affectedCount = 0;

  if (pool) {
    try {
      const res = await pool.query(
        `UPDATE bookings
         SET mobile_number = NULL,
             address = NULL,
             latitude = NULL,
             longitude = NULL,
             landmark = NULL,
             additional_notes = NULL,
             is_personal_data_deleted = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE created_at <= $1 AND is_personal_data_deleted = FALSE`,
        [sixHoursAgo]
      );
      affectedCount = res.rowCount ?? 0;
      if (affectedCount > 0) {
        console.log(`[PII Purge] Cleared PII for ${affectedCount} bookings older than 6 hours (PostgreSQL).`);
      }
      return affectedCount;
    } catch (err) {
      console.error("Error purging booking PII in PostgreSQL:", err);
    }
  }

  // Fallback purge
  const db = readJsonDb();
  let changed = false;
  db.bookings = db.bookings.map((booking) => {
    const bookingTime = new Date(booking.created_at).getTime();
    if (bookingTime <= sixHoursAgo.getTime() && !booking.is_personal_data_deleted) {
      affectedCount++;
      changed = true;
      return {
        ...booking,
        mobile_number: null,
        address: null,
        latitude: null,
        longitude: null,
        landmark: null,
        additional_notes: null,
        is_personal_data_deleted: true,
        updated_at: new Date()
      };
    }
    return booking;
  });

  if (changed) {
    writeJsonDb(db);
    console.log(`[PII Purge] Cleared PII for ${affectedCount} bookings older than 6 hours (JSON Fallback).`);
  }
  return affectedCount;
}

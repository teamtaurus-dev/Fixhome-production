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
  subcategories?: string[];
  created_at: Date;
}

export interface Worker {
  id: string;
  name: string;
  phone_number: string;
  category: string;
  photo_url: string;
  assigned_jobs: number;
  completed_jobs: number;
  created_at: Date;
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  discount_type?: "percent" | "flat";
  discount_value?: number;
  is_festival_offer: boolean;
  min_bookings_required?: number;
  code?: string;
  is_active: boolean;
  created_at: Date | string;
}

export interface AppUser {
  id: string;
  name: string;
  mobile_number: string;
  password_hash?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Booking {
  request_id: string;
  service_type: string;
  mobile_number: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  landmark: string | null;
  additional_notes: string | null;
  status: "Pending" | "Assigned" | "In Progress" | "Completed" | "Cancelled";
  is_personal_data_deleted: boolean;
  assigned_worker_id?: string | null;
  assigned_worker_name?: string | null;
  assigned_worker_phone?: string | null;
  assigned_worker_photo?: string | null;
  customer_user_phone?: string | null;
  amount?: number;
  discount_applied?: number;
  final_amount?: number;
  created_at: Date | string;
  updated_at: Date | string;
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
  workers?: Worker[];
  offers?: Offer[];
  users?: AppUser[];
}

// Read JSON database
function readJsonDb(): JsonDatabase {
  if (!fs.existsSync(JSON_DB_PATH)) {
    const initialDb: JsonDatabase = { admins: [], categories: [], bookings: [], workers: [], offers: [], users: [] };
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(initialDb, null, 2), "utf8");
    return initialDb;
  }
  try {
    const content = fs.readFileSync(JSON_DB_PATH, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed.workers) parsed.workers = [];
    if (!parsed.offers) parsed.offers = [];
    if (!parsed.users) parsed.users = [];
    return parsed;
  } catch (err) {
    console.error("Error reading JSON database, resetting", err);
    return { admins: [], categories: [], bookings: [], workers: [], offers: [], users: [] };
  }
}

// Write JSON database
function writeJsonDb(db: JsonDatabase) {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.warn("Notice: Unable to write to local database.json file:", err);
  }
}

// Initialize the database tables
export function getDbStatus(): { mode: "postgres" | "json"; hasDatabaseUrl: boolean; connected: boolean; host?: string } {
  let host = "";
  if (DATABASE_URL) {
    try {
      const match = DATABASE_URL.match(/@([^:\/]+)/);
      if (match) host = match[1];
    } catch (e) {}
  }
  return {
    mode: pool ? "postgres" : "json",
    hasDatabaseUrl: Boolean(DATABASE_URL && DATABASE_URL.trim().length > 0),
    connected: Boolean(pool),
    host: host || undefined
  };
}

export async function initDb() {
  const adminMobile = "9849758018";
  const rawAdminPassword = "mammu@143";
  const passwordHash = bcrypt.hashSync(rawAdminPassword, 10);

  // ALWAYS ensure JSON database has seed admin user so fallback mode is fully prepared
  const db = readJsonDb();
  const hasJsonAdmin = db.admins.some((a) => a.mobile_number === adminMobile);
  if (!hasJsonAdmin) {
    db.admins.push({
      id: generateUUID(),
      mobile_number: adminMobile,
      password_hash: passwordHash,
      created_at: new Date()
    });
    writeJsonDb(db);
    console.log("Successfully seeded admin user in JSON Database");
  }

  // Ensure default service categories exist in JSON database
  const pricedDefaultsMap: Record<string, string[]> = {
    "Electrical Repairs": [
      "Switchboard & Socket Fix - ₹149 - ₹249",
      "Ceiling Fan Repair & Mounting - ₹249 - ₹399",
      "MCB & Fuse Replacement - ₹299 - ₹499",
      "Light Fitting & Chandelier Work - ₹199 - ₹349"
    ],
    "Electrical Repairs & Wiring": [
      "Switchboard & Socket Fix - ₹149 - ₹249",
      "Ceiling Fan Repair & Mounting - ₹249 - ₹399",
      "MCB & Fuse Replacement - ₹299 - ₹499",
      "Light Fitting & Chandelier Work - ₹199 - ₹349"
    ],
    "Plumbing Services": [
      "Tap Leakage & Repair - ₹199 - ₹299",
      "Pipe Fitting & Replacement - ₹349 - ₹549",
      "Blockage Removal & Drainage - ₹299 - ₹499",
      "Toilet & Washbasin Fix - ₹399 - ₹599"
    ],
    "Plumbing Repair & Installation": [
      "Tap Leakage & Repair - ₹199 - ₹299",
      "Pipe Fitting & Replacement - ₹349 - ₹549",
      "Blockage Removal & Drainage - ₹299 - ₹499",
      "Toilet & Washbasin Fix - ₹399 - ₹599"
    ],
    "Carpentry & Joinery": [
      "Door Lock & Latch Repair - ₹199 - ₹299",
      "Cabinet & Drawer Hinge Fix - ₹299 - ₹449",
      "Bed & Furniture Assembly - ₹399 - ₹699",
      "Wooden Door Fitting & Shaving - ₹349 - ₹549"
    ],
    "Carpentry & Furniture Fixes": [
      "Door Lock & Latch Repair - ₹199 - ₹299",
      "Cabinet & Drawer Hinge Fix - ₹299 - ₹449",
      "Bed & Furniture Assembly - ₹399 - ₹699",
      "Wooden Door Fitting & Shaving - ₹349 - ₹549"
    ],
    "AC & Appliance Service": [
      "AC General Deep Cleaning - ₹499 - ₹799",
      "AC Gas Charging & Leak Check - ₹1499 - ₹1999",
      "Washing Machine Repair - ₹399 - ₹699",
      "Geyser Repair & De-scaling - ₹449 - ₹749"
    ],
    "House Painting & Touchups": [
      "Wall Patchwork & Waterproofing - ₹599 - ₹999",
      "Single Room Painting - ₹1499 - ₹2499",
      "Interior Wall Touchups - ₹899 - ₹1399",
      "Full House Paint Inspection Visit - ₹199 - ₹399"
    ],
    "Home Cleaning & Sanitization": [
      "Bathroom Deep Cleaning - ₹399 - ₹699",
      "Kitchen Degreasing & Wash - ₹699 - ₹1099",
      "Sofa & Mattress Shampooing - ₹599 - ₹999",
      "Full Home Deep Sanitization - ₹1999 - ₹2999"
    ]
  };

  if (db.categories.length === 0) {
    const defaultCats = [
      { name: "Electrical Repairs", desc: "Expert troubleshooting, wiring, socket replacement, and lighting repairs.", url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=600&auto=format&fit=crop", subcategories: pricedDefaultsMap["Electrical Repairs"] },
      { name: "Plumbing Services", desc: "Leaking pipes, tap repair, blockage removals, and full bathroom diagnostics.", url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=600&auto=format&fit=crop", subcategories: pricedDefaultsMap["Plumbing Services"] },
      { name: "Carpentry & Joinery", desc: "Door adjustments, furniture assembly, shelf installations, and wood polishing.", url: "https://images.unsplash.com/photo-1534224039826-c7a0dea0e66a?q=80&w=600&auto=format&fit=crop", subcategories: pricedDefaultsMap["Carpentry & Joinery"] }
    ];
    for (const cat of defaultCats) {
      db.categories.push({
        id: generateUUID(),
        name: cat.name,
        description: cat.desc,
        image_url: cat.url,
        subcategories: cat.subcategories,
        created_at: new Date()
      });
    }
    writeJsonDb(db);
    console.log("Seeded default service categories in JSON Database");
  } else {
    // Migration: ensure subcategories exist and contain pricing info
    let updated = false;
    db.categories.forEach((cat) => {
      const mapped = pricedDefaultsMap[cat.name];
      if (mapped) {
        cat.subcategories = mapped;
        updated = true;
      } else if (!cat.subcategories || cat.subcategories.length === 0) {
        cat.subcategories = ["General Inspection & Repair - ₹199", "Installation & Fitting - ₹399", "Maintenance & Servicing - ₹299"];
        updated = true;
      } else {
        // Upgrade any subcategory string missing price
        cat.subcategories = cat.subcategories.map((sub: any) => {
          if (typeof sub === "string" && !sub.includes("₹")) {
            updated = true;
            return `${sub} - ₹299`;
          }
          return sub;
        });
      }
    });
    if (updated) {
      writeJsonDb(db);
    }
  }

  // Ensure default workers exist in JSON database
  if (!db.workers || db.workers.length === 0) {
    db.workers = [
      {
        id: generateUUID(),
        name: "Ramesh Kumar",
        phone_number: "9876543210",
        category: "Electrical Repairs",
        photo_url: "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=400&q=80",
        assigned_jobs: 0,
        completed_jobs: 12,
        created_at: new Date()
      },
      {
        id: generateUUID(),
        name: "Suresh Verma",
        phone_number: "9876543211",
        category: "Plumbing Services",
        photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
        assigned_jobs: 0,
        completed_jobs: 19,
        created_at: new Date()
      },
      {
        id: generateUUID(),
        name: "Rajesh Patel",
        phone_number: "9876543212",
        category: "Carpentry & Joinery",
        photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
        assigned_jobs: 0,
        completed_jobs: 8,
        created_at: new Date()
      }
    ];
    writeJsonDb(db);
  }

  // Ensure offers array exists in JSON database
  if (!db.offers) {
    db.offers = [];
    writeJsonDb(db);
  }

  function parsePgConfig(connectionString: string): pg.PoolConfig {
  const ssl = connectionString.includes("localhost") ? false : { rejectUnauthorized: false };
  const connectionTimeoutMillis = 5000;

  // Try regex extraction to cleanly handle square brackets e.g. [password] or unencoded characters
  const match = connectionString.trim().match(/^(postgresql|postgres):\/\/([^:]+):(.*)@([^:\/]+)(?::(\d+))?\/(.+)$/);
  if (match) {
    const [_, _scheme, user, rawPass, host, portStr, dbWithQuery] = match;
    const password = rawPass.replace(/^\[|\]$/g, "");
    const dbName = dbWithQuery.split("?")[0];
    const port = portStr ? parseInt(portStr, 10) : 5432;

    return {
      user,
      password,
      host,
      port,
      database: dbName,
      ssl,
      connectionTimeoutMillis,
    };
  }

  return {
    connectionString,
    ssl,
    connectionTimeoutMillis,
  };
}

if (isPostgres) {
    console.log("Database Mode: Attempting PostgreSQL connection...");
    let tempPool: pg.Pool | null = null;
    try {
      const poolConfig = parsePgConfig(DATABASE_URL);
      tempPool = new pg.Pool(poolConfig);

      // Attach error listener to avoid unhandled error events on idle clients
      tempPool.on("error", (err) => {
        console.warn("PostgreSQL Pool background client error:", err?.message || err);
      });

      // Quick query check to verify database credentials and server readiness
      await tempPool.query("SELECT 1;");

      // Assign global pool now that connection is confirmed
      pool = tempPool;

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
          subcategories TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS subcategories TEXT;`);

      // Create workers table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS workers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          phone_number VARCHAR(20) NOT NULL,
          category VARCHAR(100) NOT NULL,
          photo_url TEXT,
          assigned_jobs INT DEFAULT 0 NOT NULL,
          completed_jobs INT DEFAULT 0 NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create offers table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS offers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(150) NOT NULL,
          description TEXT NOT NULL,
          discount_percentage INT DEFAULT 10 NOT NULL,
          is_festival_offer BOOLEAN DEFAULT TRUE NOT NULL,
          min_bookings_required INT DEFAULT 0,
          code VARCHAR(50),
          is_active BOOLEAN DEFAULT TRUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create users table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(150) NOT NULL,
          mobile_number VARCHAR(20) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure password_hash column exists on users table
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`);

      // Create bookings table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
          request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          service_type VARCHAR(100) NOT NULL,
          mobile_number VARCHAR(20),
          address TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          google_maps_url TEXT,
          landmark TEXT,
          additional_notes TEXT,
          status VARCHAR(50) DEFAULT 'Pending' NOT NULL,
          is_personal_data_deleted BOOLEAN DEFAULT FALSE NOT NULL,
          assigned_worker_id UUID,
          assigned_worker_name TEXT,
          assigned_worker_phone TEXT,
          assigned_worker_photo TEXT,
          customer_user_phone VARCHAR(20),
          amount NUMERIC(10,2),
          discount_applied NUMERIC(10,2),
          final_amount NUMERIC(10,2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure additional columns exist on bookings table if previously created
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS google_maps_url TEXT;`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_worker_id UUID;`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_worker_name TEXT;`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_worker_phone TEXT;`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_worker_photo TEXT;`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_user_phone VARCHAR(20);`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(10,2);`);
      await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2);`);

      // Convert any legacy bytea columns on bookings to text/varchar
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'mobile_number' AND data_type = 'bytea'
          ) THEN
            ALTER TABLE bookings ALTER COLUMN mobile_number TYPE VARCHAR(20) USING convert_from(mobile_number, 'UTF8');
          END IF;
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'customer_user_phone' AND data_type = 'bytea'
          ) THEN
            ALTER TABLE bookings ALTER COLUMN customer_user_phone TYPE VARCHAR(20) USING convert_from(customer_user_phone, 'UTF8');
          END IF;
        END $$;
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
          { name: "Electrical Repairs", desc: "Expert troubleshooting, wiring, socket replacement, and lighting repairs.", url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=600&auto=format&fit=crop", subcategories: ["Fan & Light Installation", "Switchboard & Wiring Repair", "Inverter & Fuse Fixes", "Appliance Power Check"] },
          { name: "Plumbing Services", desc: "Leaking pipes, tap repair, blockage removals, and full bathroom diagnostics.", url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=600&auto=format&fit=crop", subcategories: ["Tap & Faucet Repair", "Drain Unclogging & Cleaning", "Pipe Leakage Fix", "Water Tank & Basin Fitting"] },
          { name: "Carpentry & Joinery", desc: "Door adjustments, furniture assembly, shelf installations, and wood polishing.", url: "https://images.unsplash.com/photo-1534224039826-c7a0dea0e66a?q=80&w=600&auto=format&fit=crop", subcategories: ["Furniture Assembly & Repair", "Door Lock & Hinge Fitting", "Wooden Shelf Installation", "Wood Polishing & Refinishing"] }
        ];
        for (const cat of defaultCats) {
          await pool.query(
            "INSERT INTO categories (name, description, image_url, subcategories) VALUES ($1, $2, $3, $4)",
            [cat.name, cat.desc, cat.url, JSON.stringify(cat.subcategories)]
          );
        }
        console.log("Seeded default service categories in PostgreSQL");
      }

      console.log("Database initialized successfully!");
      return;
    } catch (err: any) {
      console.warn("PostgreSQL initialization notice (" + (err?.message || err) + "). Seamlessly using local JSON database fallback.");
      if (tempPool) {
        await tempPool.end().catch(() => {});
      }
      pool = null;
    }
  }
}

function sanitizeRow<T extends Record<string, any>>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (Buffer.isBuffer(val)) {
      clean[key] = val.toString("utf8");
    } else if (val && typeof val === "object" && (val as any).type === "Buffer" && Array.isArray((val as any).data)) {
      clean[key] = Buffer.from((val as any).data).toString("utf8");
    } else {
      clean[key] = val;
    }
  }
  return clean as T;
}

// Core Admin Queries
export async function getAdminByMobile(mobileNumber: string): Promise<Admin | null> {
  const rawClean = mobileNumber.trim();
  const digitsOnly = rawClean.replace(/\D/g, "");
  const last10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

  if (pool) {
    try {
      const res = await pool.query(
        "SELECT * FROM admin WHERE mobile_number = $1 OR mobile_number LIKE $2",
        [rawClean, `%${last10}`]
      );
      if (res.rowCount && res.rowCount > 0) {
        return sanitizeRow(res.rows[0]);
      }
    } catch (err) {
      console.error("Error querying admin in PostgreSQL:", err);
    }
  }

  const db = readJsonDb();
  const found = db.admins.find((a) => {
    const aClean = a.mobile_number.trim();
    const aDigits = aClean.replace(/\D/g, "");
    const aLast10 = aDigits.length >= 10 ? aDigits.slice(-10) : aDigits;
    return aClean === rawClean || (last10 && aLast10 === last10);
  });

  return found || null;
}

function formatCategory(cat: any): Category {
  const clean = sanitizeRow(cat);
  let subcats: string[] = [];
  if (clean.subcategories) {
    if (Array.isArray(clean.subcategories)) {
      subcats = clean.subcategories;
    } else if (typeof clean.subcategories === "string") {
      try {
        subcats = JSON.parse(clean.subcategories);
      } catch (e) {
        subcats = clean.subcategories.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }
  }
  return {
    id: clean.id,
    name: clean.name,
    description: clean.description,
    image_url: clean.image_url,
    subcategories: subcats,
    created_at: clean.created_at
  };
}

// Categories CRUD Operations
export async function getCategories(): Promise<Category[]> {
  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM categories ORDER BY created_at DESC");
      return res.rows.map((r) => formatCategory(r));
    } catch (err) {
      console.error("Error querying categories in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  return [...db.categories].map((c) => formatCategory(c)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addCategory(name: string, description: string, imageUrl: string, subcategories: string[] = []): Promise<Category> {
  const cleanSubcats = Array.isArray(subcategories) ? subcategories.map(s => s.trim()).filter(Boolean) : [];
  if (pool) {
    try {
      const res = await pool.query(
        "INSERT INTO categories (name, description, image_url, subcategories) VALUES ($1, $2, $3, $4) RETURNING *",
        [name, description, imageUrl, JSON.stringify(cleanSubcats)]
      );
      return formatCategory(res.rows[0]);
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
    subcategories: cleanSubcats,
    created_at: new Date()
  };
  db.categories.push(newCat);
  writeJsonDb(db);
  return newCat;
}

export async function updateCategory(
  id: string,
  data: {
    name?: string;
    description?: string;
    imageUrl?: string;
    subcategories?: string[];
  }
): Promise<Category | null> {
  if (pool) {
    try {
      const existing = await pool.query("SELECT * FROM categories WHERE id = $1", [id]);
      if (existing.rowCount && existing.rowCount > 0) {
        const current = existing.rows[0];
        const newName = data.name !== undefined ? data.name : current.name;
        const newDesc = data.description !== undefined ? data.description : current.description;
        const newImg = data.imageUrl !== undefined && data.imageUrl ? data.imageUrl : current.image_url;
        let newSubcats = current.subcategories;
        if (data.subcategories !== undefined) {
          newSubcats = Array.isArray(data.subcategories) ? data.subcategories : [];
        } else if (typeof current.subcategories === "string") {
          try {
            newSubcats = JSON.parse(current.subcategories);
          } catch (e) {
            newSubcats = [];
          }
        }

        const res = await pool.query(
          "UPDATE categories SET name = $1, description = $2, image_url = $3, subcategories = $4 WHERE id = $5 RETURNING *",
          [newName, newDesc, newImg, JSON.stringify(newSubcats), id]
        );
        if (res.rowCount && res.rowCount > 0) {
          return formatCategory(res.rows[0]);
        }
      }
    } catch (err) {
      console.error("Error updating category in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  const cat = db.categories.find((c) => c.id === id);
  if (cat) {
    if (data.name !== undefined) cat.name = data.name;
    if (data.description !== undefined) cat.description = data.description;
    if (data.imageUrl !== undefined && data.imageUrl) cat.image_url = data.imageUrl;
    if (data.subcategories !== undefined) {
      cat.subcategories = Array.isArray(data.subcategories)
        ? data.subcategories.map((s) => s.trim()).filter(Boolean)
        : [];
    }
    writeJsonDb(db);
    return formatCategory(cat);
  }
  return null;
}

export async function updateCategorySubcategories(id: string, subcategories: string[]): Promise<Category | null> {
  const cleanSubcats = Array.isArray(subcategories) ? subcategories.map(s => s.trim()).filter(Boolean) : [];
  if (pool) {
    try {
      const res = await pool.query(
        "UPDATE categories SET subcategories = $1 WHERE id = $2 RETURNING *",
        [JSON.stringify(cleanSubcats), id]
      );
      if (res.rowCount && res.rowCount > 0) {
        return formatCategory(res.rows[0]);
      }
    } catch (err) {
      console.error("Error updating subcategories in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  const cat = db.categories.find((c) => c.id === id);
  if (cat) {
    cat.subcategories = cleanSubcats;
    writeJsonDb(db);
    return formatCategory(cat);
  }
  return null;
}

export async function deleteCategory(id: string): Promise<boolean> {
  if (pool) {
    try {
      const res = await pool.query("DELETE FROM categories WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error("Error deleting category in PostgreSQL:", err);
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

// Workers CRUD Operations
export async function getWorkers(): Promise<Worker[]> {
  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM workers ORDER BY created_at DESC");
      return res.rows.map((r) => sanitizeRow(r));
    } catch (err) {
      console.error("Error querying workers in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  return (db.workers || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addWorker(name: string, phoneNumber: string, category: string, photoUrl: string): Promise<Worker> {
  if (pool) {
    try {
      const res = await pool.query(
        "INSERT INTO workers (name, phone_number, category, photo_url, assigned_jobs, completed_jobs) VALUES ($1, $2, $3, $4, 0, 0) RETURNING *",
        [name, phoneNumber, category, photoUrl]
      );
      return sanitizeRow(res.rows[0]);
    } catch (err) {
      console.error("Error adding worker in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  const newWorker: Worker = {
    id: generateUUID(),
    name,
    phone_number: phoneNumber,
    category,
    photo_url: photoUrl,
    assigned_jobs: 0,
    completed_jobs: 0,
    created_at: new Date()
  };
  if (!db.workers) db.workers = [];
  db.workers.push(newWorker);
  writeJsonDb(db);
  return newWorker;
}

export async function updateWorker(
  id: string,
  updates: { name?: string; phoneNumber?: string; category?: string; photoUrl?: string }
): Promise<Worker | null> {
  if (pool) {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.phoneNumber !== undefined) {
        fields.push(`phone_number = $${idx++}`);
        values.push(updates.phoneNumber);
      }
      if (updates.category !== undefined) {
        fields.push(`category = $${idx++}`);
        values.push(updates.category);
      }
      if (updates.photoUrl !== undefined) {
        fields.push(`photo_url = $${idx++}`);
        values.push(updates.photoUrl);
      }

      if (fields.length > 0) {
        values.push(id);
        const query = `UPDATE workers SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
        const res = await pool.query(query, values);
        if (res.rowCount && res.rowCount > 0) {
          return sanitizeRow(res.rows[0]);
        }
      }
    } catch (err) {
      console.error("Error updating worker in PostgreSQL:", err);
    }
  }

  const db = readJsonDb();
  if (!db.workers) return null;
  const worker = db.workers.find((w) => w.id === id);
  if (worker) {
    if (updates.name !== undefined) worker.name = updates.name;
    if (updates.phoneNumber !== undefined) worker.phone_number = updates.phoneNumber;
    if (updates.category !== undefined) worker.category = updates.category;
    if (updates.photoUrl !== undefined) worker.photo_url = updates.photoUrl;
    writeJsonDb(db);
    return worker;
  }
  return null;
}

export async function deleteWorker(id: string): Promise<boolean> {
  if (pool) {
    try {
      const res = await pool.query("DELETE FROM workers WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error("Error deleting worker in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  if (!db.workers) return false;
  const initialLen = db.workers.length;
  db.workers = db.workers.filter((w) => w.id !== id);
  if (db.workers.length < initialLen) {
    writeJsonDb(db);
    return true;
  }
  return false;
}

// Offers CRUD Operations
export async function getOffers(): Promise<Offer[]> {
  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM offers ORDER BY created_at DESC");
      return res.rows.map((r) => sanitizeRow(r));
    } catch (err) {
      console.error("Error querying offers in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  return (db.offers || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function addOffer(data: {
  title: string;
  description: string;
  discount_percentage: number;
  discount_type?: "percent" | "flat";
  discount_value?: number;
  is_festival_offer: boolean;
  min_bookings_required?: number;
  code?: string;
  is_active?: boolean;
}): Promise<Offer> {
  const codeVal = (data.code || `OFFER${data.discount_value || data.discount_percentage}`).toUpperCase().trim();
  const isActive = data.is_active !== undefined ? data.is_active : true;
  const minBookings = data.min_bookings_required || 0;
  const discountType = data.discount_type || "percent";
  const discountVal = data.discount_value !== undefined ? data.discount_value : data.discount_percentage;

  if (pool) {
    try {
      const res = await pool.query(
        `INSERT INTO offers (title, description, discount_percentage, discount_type, discount_value, is_festival_offer, min_bookings_required, code, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [data.title, data.description, discountVal, discountType, discountVal, data.is_festival_offer, minBookings, codeVal, isActive]
      );
      return sanitizeRow(res.rows[0]);
    } catch (err) {
      console.error("Error adding offer in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  const newOffer: Offer = {
    id: generateUUID(),
    title: data.title,
    description: data.description,
    discount_percentage: discountVal,
    discount_type: discountType,
    discount_value: discountVal,
    is_festival_offer: data.is_festival_offer,
    min_bookings_required: minBookings,
    code: codeVal,
    is_active: isActive,
    created_at: new Date().toISOString()
  };
  if (!db.offers) db.offers = [];
  db.offers.push(newOffer);
  writeJsonDb(db);
  return newOffer;
}

export async function toggleOfferActive(id: string, isActive: boolean): Promise<Offer | null> {
  if (pool) {
    try {
      const res = await pool.query(
        "UPDATE offers SET is_active = $1 WHERE id = $2 RETURNING *",
        [isActive, id]
      );
      if (res.rowCount && res.rowCount > 0) return sanitizeRow(res.rows[0]);
    } catch (err) {
      console.error("Error toggling offer in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  if (!db.offers) return null;
  const offer = db.offers.find((o) => o.id === id);
  if (offer) {
    offer.is_active = isActive;
    writeJsonDb(db);
    return offer;
  }
  return null;
}

export async function deleteOffer(id: string): Promise<boolean> {
  if (pool) {
    try {
      const res = await pool.query("DELETE FROM offers WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    } catch (err) {
      console.error("Error deleting offer in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  if (!db.offers) return false;
  const initLen = db.offers.length;
  db.offers = db.offers.filter((o) => o.id !== id);
  if (db.offers.length < initLen) {
    writeJsonDb(db);
    return true;
  }
  return false;
}

// Helper to ensure google_maps_url is present whenever latitude and longitude or address exist
function ensureMapsUrl(b: Booking | null): Booking | null {
  if (!b) return null;
  b = sanitizeRow(b);
  if (!b.google_maps_url) {
    if (b.latitude != null && b.longitude != null) {
      b.google_maps_url = `https://maps.google.com/?q=${b.latitude},${b.longitude}`;
    } else if (b.address && typeof b.address === "string" && b.address.trim()) {
      b.google_maps_url = `https://maps.google.com/?q=${encodeURIComponent(b.address.trim())}`;
    }
  }
  return b;
}

// Bookings CRUD Operations
export async function createBooking(data: {
  service_type: string;
  mobile_number: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  google_maps_url?: string | null;
  landmark?: string;
  additional_notes?: string;
  amount?: number;
  discount_applied?: number;
  final_amount?: number;
}): Promise<Booking> {
  const generatedMapsUrl = (data.latitude != null && data.longitude != null)
    ? `https://maps.google.com/?q=${data.latitude},${data.longitude}`
    : (data.address && data.address.trim())
      ? `https://maps.google.com/?q=${encodeURIComponent(data.address.trim())}`
      : (data.google_maps_url || null);

  if (pool) {
    try {
      const res = await pool.query(
        `INSERT INTO bookings (
           service_type, mobile_number, address, latitude, longitude,
           google_maps_url, landmark, additional_notes, customer_user_phone,
           amount, discount_applied, final_amount
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [
          data.service_type,
          data.mobile_number,
          data.address,
          data.latitude,
          data.longitude,
          generatedMapsUrl,
          data.landmark || null,
          data.additional_notes || null,
          data.mobile_number,
          data.amount || 499,
          data.discount_applied || 0,
          data.final_amount || (data.amount || 499) - (data.discount_applied || 0)
        ]
      );
      return ensureMapsUrl(res.rows[0])!;
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
    google_maps_url: generatedMapsUrl,
    landmark: data.landmark || null,
    additional_notes: data.additional_notes || null,
    customer_user_phone: data.mobile_number,
    amount: data.amount || 499,
    discount_applied: data.discount_applied || 0,
    final_amount: (data.amount || 499) - (data.discount_applied || 0),
    status: "Pending",
    is_personal_data_deleted: false,
    created_at: new Date(),
    updated_at: new Date()
  };
  db.bookings.push(newBooking);
  writeJsonDb(db);
  return newBooking;
}

export async function assignWorkerToBooking(requestId: string, workerId: string | null): Promise<Booking | null> {
  let prevWorkerId: string | null = null;
  let newWorkerObj: Worker | null = null;

  // Get current booking
  const currentBooking = await getBookingById(requestId);
  if (!currentBooking) return null;
  prevWorkerId = currentBooking.assigned_worker_id || null;

  if (workerId) {
    const workers = await getWorkers();
    newWorkerObj = workers.find((w) => w.id === workerId) || null;
  }

  // Update worker assigned_jobs counters
  if (pool) {
    try {
      // Decrement previous worker if changed
      if (prevWorkerId && prevWorkerId !== workerId) {
        await pool.query(
          "UPDATE workers SET assigned_jobs = GREATEST(0, assigned_jobs - 1) WHERE id = $1",
          [prevWorkerId]
        );
      }
      // Increment new worker if assigned
      if (workerId && prevWorkerId !== workerId) {
        await pool.query(
          "UPDATE workers SET assigned_jobs = assigned_jobs + 1 WHERE id = $1",
          [workerId]
        );
      }

      const res = await pool.query(
        `UPDATE bookings
         SET assigned_worker_id = $1,
             assigned_worker_name = $2,
             assigned_worker_phone = $3,
             assigned_worker_photo = $4,
             status = CASE WHEN $1::UUID IS NOT NULL AND status = 'Pending' THEN 'Assigned' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE request_id = $5
         RETURNING *`,
        [
          workerId,
          newWorkerObj ? newWorkerObj.name : null,
          newWorkerObj ? newWorkerObj.phone_number : null,
          newWorkerObj ? newWorkerObj.photo_url : null,
          requestId
        ]
      );
      if (res.rowCount && res.rowCount > 0) {
        return ensureMapsUrl(res.rows[0]);
      }
    } catch (err) {
      console.error("Error assigning worker in PostgreSQL:", err);
    }
  }

  // Fallback to JSON DB
  const db = readJsonDb();
  if (db.workers) {
    if (prevWorkerId && prevWorkerId !== workerId) {
      const pw = db.workers.find((w) => w.id === prevWorkerId);
      if (pw) pw.assigned_jobs = Math.max(0, pw.assigned_jobs - 1);
    }
    if (workerId && prevWorkerId !== workerId) {
      const nw = db.workers.find((w) => w.id === workerId);
      if (nw) nw.assigned_jobs += 1;
    }
  }

  const b = db.bookings.find((item) => item.request_id === requestId);
  if (b) {
    b.assigned_worker_id = workerId;
    b.assigned_worker_name = newWorkerObj ? newWorkerObj.name : null;
    b.assigned_worker_phone = newWorkerObj ? newWorkerObj.phone_number : null;
    b.assigned_worker_photo = newWorkerObj ? newWorkerObj.photo_url : null;
    if (workerId && b.status === "Pending") {
      b.status = "Assigned";
    }
    b.updated_at = new Date();
    writeJsonDb(db);
    return ensureMapsUrl(b);
  }
  return null;
}

export async function getBookingsByMobile(mobileNumber: string): Promise<Booking[]> {
  try {
    await purgeOldBookingsPII();
  } catch (e) {}

  const rawClean = mobileNumber.trim();
  const digitsOnly = rawClean.replace(/\D/g, "");
  const last10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

  if (pool) {
    try {
      const res = await pool.query(
        `SELECT * FROM bookings
         WHERE mobile_number = $1
            OR customer_user_phone = $1
            OR mobile_number LIKE $2
            OR customer_user_phone LIKE $2
         ORDER BY created_at DESC`,
        [rawClean, `%${last10}`]
      );
      return res.rows.map((b) => ensureMapsUrl(b)!);
    } catch (err) {
      console.error("Error querying bookings by mobile in PostgreSQL:", err);
    }
  }

  const db = readJsonDb();
  return db.bookings
    .filter((b) => {
      const m1 = (b.mobile_number || "").replace(/\D/g, "");
      const m2 = (b.customer_user_phone || "").replace(/\D/g, "");
      const l1 = m1.length >= 10 ? m1.slice(-10) : m1;
      const l2 = m2.length >= 10 ? m2.slice(-10) : m2;
      return l1 === last10 || l2 === last10 || b.mobile_number === rawClean || b.customer_user_phone === rawClean;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((b) => ensureMapsUrl(b)!);
}

export async function getBookingById(requestId: string): Promise<Booking | null> {
  try {
    await purgeOldBookingsPII();
  } catch (e) {}

  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM bookings WHERE request_id = $1", [requestId]);
      if (res.rowCount && res.rowCount > 0) {
        return ensureMapsUrl(res.rows[0]);
      }
    } catch (err) {
      console.error("Error fetching booking by ID in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  const found = db.bookings.find((b) => b.request_id === requestId);
  return found ? ensureMapsUrl(found) : null;
}

export async function getBookings(): Promise<Booking[]> {
  try {
    await purgeOldBookingsPII();
  } catch (e) {}

  if (pool) {
    try {
      const res = await pool.query("SELECT * FROM bookings ORDER BY created_at DESC");
      return res.rows.map((b) => ensureMapsUrl(b)!);
    } catch (err) {
      console.error("Error querying bookings in PostgreSQL:", err);
    }
  }
  const db = readJsonDb();
  return [...db.bookings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((b) => ensureMapsUrl(b)!);
}

export async function updateBookingStatus(
  requestId: string,
  status: "Pending" | "Assigned" | "In Progress" | "Completed" | "Cancelled",
  fallbackData?: Partial<Booking>
): Promise<Booking | null> {
  // Check if status is transitioning to Completed and update worker metrics
  const current = await getBookingById(requestId);
  if (current && current.status !== "Completed" && status === "Completed" && current.assigned_worker_id) {
    if (pool) {
      try {
        await pool.query(
          "UPDATE workers SET assigned_jobs = GREATEST(0, assigned_jobs - 1), completed_jobs = completed_jobs + 1 WHERE id = $1",
          [current.assigned_worker_id]
        );
      } catch (err) {
        console.error("Error updating worker metrics on completion:", err);
      }
    }
    const db = readJsonDb();
    if (db.workers) {
      const w = db.workers.find((item) => item.id === current.assigned_worker_id);
      if (w) {
        w.assigned_jobs = Math.max(0, w.assigned_jobs - 1);
        w.completed_jobs += 1;
      }
    }
  }

  if (pool) {
    try {
      if (status === "Cancelled") {
        const res = await pool.query(
          `UPDATE bookings
           SET status = $1,
               mobile_number = NULL,
               address = NULL,
               latitude = NULL,
               longitude = NULL,
               google_maps_url = NULL,
               landmark = NULL,
               additional_notes = NULL,
               is_personal_data_deleted = TRUE,
               updated_at = CURRENT_TIMESTAMP
           WHERE request_id = $2
           RETURNING *`,
          [status, requestId]
        );
        if (res.rowCount && res.rowCount > 0) {
          return ensureMapsUrl(res.rows[0]);
        }
      } else {
        const res = await pool.query(
          "UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE request_id = $2 RETURNING *",
          [status, requestId]
        );
        if (res.rowCount && res.rowCount > 0) {
          return ensureMapsUrl(res.rows[0]);
        }
      }
    } catch (err) {
      console.error("Error updating booking status in PostgreSQL:", err);
    }
  }

  const db = readJsonDb();
  let booking = db.bookings.find((b) => b.request_id === requestId);
  if (!booking && fallbackData) {
    booking = {
      request_id: requestId,
      service_type: fallbackData.service_type || "Home Service",
      mobile_number: fallbackData.mobile_number || null,
      address: fallbackData.address || null,
      google_maps_url: fallbackData.google_maps_url || null,
      landmark: fallbackData.landmark || null,
      additional_notes: fallbackData.additional_notes || null,
      customer_user_phone: fallbackData.customer_user_phone || fallbackData.mobile_number || null,
      amount: Number(fallbackData.amount || 0),
      discount_applied: Number(fallbackData.discount_applied || 0),
      final_amount: Number(fallbackData.final_amount || 0),
      status: status,
      is_personal_data_deleted: status === "Cancelled",
      created_at: fallbackData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      latitude: fallbackData.latitude || null,
      longitude: fallbackData.longitude || null,
      assigned_worker_id: fallbackData.assigned_worker_id || null,
      assigned_worker_name: fallbackData.assigned_worker_name || null,
      assigned_worker_phone: fallbackData.assigned_worker_phone || null,
      assigned_worker_photo: fallbackData.assigned_worker_photo || null
    };
    db.bookings.push(booking);
  }

  if (booking) {
    booking.status = status;
    booking.updated_at = new Date().toISOString();
    if (status === "Cancelled") {
      booking.mobile_number = null;
      booking.address = null;
      booking.latitude = null;
      booking.longitude = null;
      booking.google_maps_url = null;
      booking.landmark = null;
      booking.additional_notes = null;
      booking.is_personal_data_deleted = true;
    } else if (status === "Completed") {
      // Retain customer information for permanent history record
      if (fallbackData) {
        if (fallbackData.mobile_number && !booking.mobile_number) booking.mobile_number = fallbackData.mobile_number;
        if (fallbackData.address && !booking.address) booking.address = fallbackData.address;
        if (fallbackData.service_type && !booking.service_type) booking.service_type = fallbackData.service_type;
        if (fallbackData.customer_user_phone && !booking.customer_user_phone) booking.customer_user_phone = fallbackData.customer_user_phone;
      }
    }
    writeJsonDb(db);
    return ensureMapsUrl(booking);
  }
  return null;
}

/**
 * Cancel a booking request before a technician has been assigned.
 * Automatically deletes customer personal details (PII) upon cancellation.
 */
export async function cancelBooking(
  requestId: string
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  const current = await getBookingById(requestId);
  if (!current) {
    return { success: false, error: "Booking request not found." };
  }

  // Strictly enforce: cancellation only allowed before a worker is assigned
  if (current.status !== "Pending" || current.assigned_worker_id || current.assigned_worker_name) {
    return {
      success: false,
      error: "Service cannot be cancelled after a worker or technician has been assigned."
    };
  }

  if (pool) {
    try {
      const res = await pool.query(
        `UPDATE bookings
         SET status = 'Cancelled',
             mobile_number = NULL,
             address = NULL,
             latitude = NULL,
             longitude = NULL,
             google_maps_url = NULL,
             landmark = NULL,
             additional_notes = NULL,
             is_personal_data_deleted = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE request_id = $1
         RETURNING *`,
        [requestId]
      );
      if (res.rowCount && res.rowCount > 0) {
        return { success: true, booking: ensureMapsUrl(res.rows[0])! };
      }
    } catch (err: any) {
      console.error("Error cancelling booking in PostgreSQL:", err);
    }
  }

  const db = readJsonDb();
  const booking = db.bookings.find((b) => b.request_id === requestId);
  if (booking) {
    booking.status = "Cancelled";
    booking.mobile_number = null;
    booking.address = null;
    booking.latitude = null;
    booking.longitude = null;
    booking.google_maps_url = null;
    booking.landmark = null;
    booking.additional_notes = null;
    booking.is_personal_data_deleted = true;
    booking.updated_at = new Date();
    writeJsonDb(db);
    return { success: true, booking: ensureMapsUrl(booking)! };
  }

  return { success: false, error: "Could not update booking status to Cancelled." };
}

export async function purgeBookingPIIById(requestId: string): Promise<Booking | null> {
  if (pool) {
    try {
      const res = await pool.query(
        `UPDATE bookings
         SET mobile_number = NULL,
             address = NULL,
             latitude = NULL,
             longitude = NULL,
             google_maps_url = NULL,
             landmark = NULL,
             additional_notes = NULL,
             is_personal_data_deleted = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE request_id = $1
         RETURNING *`,
        [requestId]
      );
      if (res.rowCount && res.rowCount > 0) {
        return res.rows[0];
      }
    } catch (err) {
      console.error("Error purging PII for booking in PostgreSQL:", err);
    }
  }

  const db = readJsonDb();
  const booking = db.bookings.find((b) => b.request_id === requestId);
  if (booking) {
    booking.mobile_number = null;
    booking.address = null;
    booking.latitude = null;
    booking.longitude = null;
    booking.google_maps_url = null;
    booking.landmark = null;
    booking.additional_notes = null;
    booking.is_personal_data_deleted = true;
    booking.updated_at = new Date();
    writeJsonDb(db);
    return booking;
  }
  return null;
}

// DATA RETENTION POLICY: Customer personal details (location, phone, address, notes) auto-delete after 6 hours
// while service records (request_id, service_type, status, created_at) are permanently retained.
export async function purgeOldBookingsPII(): Promise<number> {
  let totalPurged = 0;

  if (pool) {
    try {
      const res = await pool.query(`
        UPDATE bookings
        SET mobile_number = NULL,
            address = NULL,
            latitude = NULL,
            longitude = NULL,
            google_maps_url = NULL,
            landmark = NULL,
            additional_notes = NULL,
            is_personal_data_deleted = TRUE
        WHERE created_at < NOW() - INTERVAL '6 hours'
          AND is_personal_data_deleted = FALSE
      `);
      totalPurged = res.rowCount ?? 0;
      if (totalPurged > 0) {
        console.log(`Auto-purged PII for ${totalPurged} bookings older than 6 hours in PostgreSQL.`);
      }
    } catch (err) {
      console.error("Error purging old bookings PII in PostgreSQL:", err);
    }
  }

  // Also execute purge on JSON file storage fallback
  try {
    const db = readJsonDb();
    const now = Date.now();
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    let jsonPurged = 0;

    db.bookings.forEach((booking) => {
      const createdAtMs = new Date(booking.created_at).getTime();
      if (!booking.is_personal_data_deleted && (now - createdAtMs >= SIX_HOURS_MS)) {
        booking.mobile_number = null;
        booking.address = null;
        booking.latitude = null;
        booking.longitude = null;
        booking.google_maps_url = null;
        booking.landmark = null;
        booking.additional_notes = null;
        booking.is_personal_data_deleted = true;
        jsonPurged++;
      }
    });

    if (jsonPurged > 0) {
      writeJsonDb(db);
      console.log(`Auto-purged PII for ${jsonPurged} bookings older than 6 hours in JSON DB.`);
      if (!pool) {
        totalPurged = jsonPurged;
      }
    }
  } catch (err) {
    console.error("Error purging old bookings PII in JSON DB:", err);
  }

  return totalPurged;
}

// USER REGISTRATION & DATABASE STORAGE FUNCTIONS
export async function saveUser(name: string, mobileNumber: string, password?: string): Promise<AppUser> {
  const cleanMobile = String(mobileNumber).trim();
  const cleanName = String(name).trim();
  const passwordHash = password ? bcrypt.hashSync(password, 10) : undefined;

  if (pool) {
    try {
      if (passwordHash) {
        const res = await pool.query(
          `INSERT INTO users (name, mobile_number, password_hash, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           ON CONFLICT (mobile_number) 
           DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [cleanName, cleanMobile, passwordHash]
        );
        if (res.rows && res.rows.length > 0) {
          return res.rows[0];
        }
      } else {
        const res = await pool.query(
          `INSERT INTO users (name, mobile_number, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (mobile_number) 
           DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [cleanName, cleanMobile]
        );
        if (res.rows && res.rows.length > 0) {
          return res.rows[0];
        }
      }
    } catch (err) {
      console.error("Error saving user in PostgreSQL:", err);
    }
  }

  // JSON DB Fallback
  const db = readJsonDb();
  if (!db.users) db.users = [];

  let existing = db.users.find((u) => u.mobile_number === cleanMobile);
  if (existing) {
    existing.name = cleanName;
    if (passwordHash) {
      existing.password_hash = passwordHash;
    }
    existing.updated_at = new Date();
    writeJsonDb(db);
    return existing;
  }

  const newUser: AppUser = {
    id: generateUUID(),
    name: cleanName,
    mobile_number: cleanMobile,
    password_hash: passwordHash,
    created_at: new Date(),
    updated_at: new Date()
  };
  db.users.push(newUser);
  writeJsonDb(db);
  return newUser;
}

export async function verifyUserLogin(mobileNumber: string, password: string): Promise<{ success: boolean; user?: AppUser; message?: string }> {
  const cleanMobile = String(mobileNumber).trim();
  const user = await getUserByMobile(cleanMobile);

  if (!user) {
    return { success: false, message: "No user account found with this mobile number. Please register first." };
  }

  if (user.password_hash) {
    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return { success: false, message: "Incorrect password. Please verify your password and try again." };
    }
    return { success: true, user };
  } else {
    // Legacy user record without password_hash set: claim account by setting initial password
    const updated = await saveUser(user.name, cleanMobile, password);
    return { success: true, user: updated };
  }
}

export async function getUserByMobile(mobileNumber: string): Promise<AppUser | null> {
  const cleanMobile = String(mobileNumber).trim();
  if (pool) {
    try {
      const res = await pool.query(`SELECT * FROM users WHERE mobile_number = $1`, [cleanMobile]);
      if (res.rows && res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (err) {
      console.error("Error getting user by mobile in PostgreSQL:", err);
    }
  }

  const db = readJsonDb();
  if (!db.users) db.users = [];
  return db.users.find((u) => u.mobile_number === cleanMobile) || null;
}

export async function getAllUsers(): Promise<AppUser[]> {
  if (pool) {
    try {
      const res = await pool.query(`SELECT * FROM users ORDER BY created_at DESC`);
      return res.rows;
    } catch (err) {
      console.error("Error fetching all users in PostgreSQL:", err);
    }
  }

  const db = readJsonDb();
  return db.users || [];
}


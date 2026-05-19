import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Database pool configuration linking directly to your Aiven MySQL instance
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'brealls_resorts',
  port: Number(process.env.MYSQL_PORT) || 12345,
  ssl: {
    rejectUnauthorized: false 
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- USERS API ---
// Fetch all users for administration management
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, phone, created_at FROM users');
    res.json(rows);
  } catch (error) {
    console.error("❌ MySQL Error (Users Fetch):", error.message);
    res.status(500).json({ error: 'Database query failed', details: error.message });
  }
});

// --- ROOMS API ---
// Fetch all resort accommodations (Lodges & Cottages)
app.get("/api/rooms", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM rooms");
    res.json(rows);
  } catch (err) {
    console.error("❌ MySQL Error (Rooms Fetch):", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update specific accommodation options, pricing, or basic availability flag
app.put("/api/rooms/:id", async (req, res) => {
  const { name, type, capacity, price, description, image_url, available } = req.body;
  try {
    await pool.query(
      "UPDATE rooms SET name = ?, type = ?, capacity = ?, price = ?, description = ?, image_url = ?, available = ? WHERE id = ?", 
      [name, type, capacity, price, description, image_url, available, req.params.id]
    );
    res.json({ success: true, message: "Room settings updated successfully" });
  } catch (err) {
    console.error("❌ MySQL Error (Rooms Update):", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- BOOKINGS API ---
// Fetch complete master bookings sheet utilizing your handy SQL view `v_booked_records`
app.get("/api/bookings", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM v_booked_records");
    res.json(rows);
  } catch (err) {
    console.error("❌ MySQL Error (Bookings Fetch):", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Post/Submit a brand new checkout reservation entry directly to the table database
app.post("/api/bookings", async (req, res) => {
  const {
    room_id,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    check_in,
    check_out,
    guests,
    rooms_qty,
    total,
    downpayment,
    balance,
    payment_method,
    payment_status,
    payment_reference,
    payment_proof,
    status
  } = req.body;

  try {
    // 1. Conflict Check: Ensure the room didn't get reserved by someone else concurrently
    const [conflicts] = await pool.query(
      `SELECT * FROM v_active_bookings 
       WHERE room_id = ? AND check_in < ? AND check_out > ?`,
      [room_id, check_out, check_in]
    );

    if (conflicts.length > 0) {
      return res.status(400).json({ error: "The chosen room is already booked for these selected dates." });
    }

    // 2. Insert into the bookings table
    const [result] = await pool.query(
      `INSERT INTO bookings (
        room_id, customer_id, customer_name, customer_email, customer_phone, 
        check_in, check_out, guests, rooms_qty, total, downpayment, balance, 
        payment_method, payment_status, payment_reference, payment_proof, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room_id, customer_id, customer_name, customer_email, customer_phone,
        check_in, check_out, guests, rooms_qty || 1, total, downpayment, balance,
        payment_method, payment_status || 'Awaiting Verification', payment_reference || null, 
        payment_proof || null, status || 'Pending'
      ]
    );

    res.status(201).json({ success: true, bookingId: result.insertId });
  } catch (err) {
    console.error("❌ MySQL Error (Bookings Insertion Failure):", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update an existing booking's confirmation or billing status (e.g., confirming a downpayment)
app.put("/api/bookings/:id", async (req, res) => {
  const { payment_status, status, payment_reference } = req.body;
  try {
    await pool.query(
      "UPDATE bookings SET payment_status = ?, status = ?, payment_reference = COALESCE(?, payment_reference) WHERE id = ?",
      [payment_status, status, payment_reference, req.params.id]
    );
    res.json({ success: true, message: "Reservation status updated successfully" });
  } catch (err) {
    console.error("❌ MySQL Error (Bookings Modification):", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- AUTH / ACCOUNTS API ---
// Simple login routing handling credentials lookup based on your schema fields
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body; // Using email instead of a generic username to match your schema
  try {
    // In production, fetch the user by email, then verify the password with bcrypt/argon2!
    const [rows] = await pool.query("SELECT id, name, email, role, phone FROM users WHERE email = ? AND password_hash = ?", [email, password]);
    
    if (rows.length > 0) {
      res.json({ success: true, user: rows[0] });
    } else {
      res.status(401).json({ success: false, message: "Invalid email or password combination." });
    }
  } catch (err) {
    console.error("❌ MySQL Error (Authentication handling):", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- SITE SETTINGS API ---
// Fetch current global resort rules, images, and context options
app.get("/api/settings", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM site_settings WHERE id = 1");
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ MySQL Error (Settings Fetch):", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update management variables, banner layouts, or payment info (Enforces constraint id = 1)
app.put("/api/settings", async (req, res) => {
  const { 
    hero_image, hero_title, hero_subtitle, contact_phone, contact_email, 
    contact_location, downpayment_percent, gcash_number, gcash_name, 
    bank_name, bank_account_number, bank_account_name 
  } = req.body;
  
  try {
    await pool.query(
      `UPDATE site_settings SET 
        hero_image = ?, hero_title = ?, hero_subtitle = ?, contact_phone = ?, 
        contact_email = ?, contact_location = ?, downpayment_percent = ?, 
        gcash_number = ?, gcash_name = ?, bank_name = ?, bank_account_number = ?, 
        bank_account_name = ? 
       WHERE id = 1`,
      [
        hero_image, hero_title, hero_subtitle, contact_phone, contact_email,
        contact_location, downpayment_percent, gcash_number, gcash_name,
        bank_name, bank_account_number, bank_account_name
      ]
    );
    res.json({ success: true, message: "Global resort options configured successfully." });
  } catch (err) {
    console.error("❌ MySQL Error (Settings Compilation Error):", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend build distributions static production assets
app.use(express.static(path.join(__dirname, "dist")));

// React client deployment routing fallback 
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Brealls Resorts Link Server online on port ${PORT}`));

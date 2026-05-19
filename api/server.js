import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Replace these details with your actual Aiven MySQL Connection strings
const pool = mysql.createPool({
  host: 'your-aiven-mysql-hostname', 
  user: 'your-aiven-username',
  password: 'your-aiven-password',
  database: 'brealls_resorts',
  port: 12345, // Your Aiven Port
  ssl: { rejectUnauthorized: false } // Required for Aiven SSL connections
});

// Endpoint to fetch the users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role FROM users');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend bridge running on port ${PORT}`));

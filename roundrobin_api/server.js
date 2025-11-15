require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increased limit for photo data

// DB Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection error:", err.stack);
  } else {
    console.log("✅ Database connected successfully");
    release();
  }
});

// ========================================
// PLAYERS API
// ========================================

// GET ALL PLAYERS
app.get("/players", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM players ORDER BY id");
    res.json(result.rows);
  } catch (e) {
    console.error("GET /players error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// ADD OR UPDATE PLAYER (with proper ID handling)
app.post("/players", async (req, res) => {
  try {
    const { id, sno, name, phone, adhaar, duedate, gender, photo } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Player name is required" });
    }

    // Check if player with this ID already exists
    if (id) {
      const existing = await pool.query(
        "SELECT id FROM players WHERE id = $1",
        [id]
      );

      if (existing.rows.length > 0) {
        // UPDATE existing player
        const result = await pool.query(
          `UPDATE players 
           SET name = $1, phone = $2, adhaar = $3, duedate = $4, gender = $5, photo = $6, sno = $7
           WHERE id = $8
           RETURNING *`,
          [
            name,
            phone || "",
            adhaar || "",
            duedate || null,
            gender || "Boys",
            photo || "",
            sno || 0,
            id,
          ]
        );
        return res.json(result.rows[0]);
      }
    }

    // INSERT new player (with ID if provided, or let DB generate)
    const result = await pool.query(
      `INSERT INTO players (id, sno, name, phone, adhaar, duedate, gender, photo) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       ON CONFLICT (id) DO UPDATE 
       SET name = EXCLUDED.name, 
           phone = EXCLUDED.phone, 
           adhaar = EXCLUDED.adhaar, 
           duedate = EXCLUDED.duedate,
           gender = EXCLUDED.gender,
           photo = EXCLUDED.photo,
           sno = EXCLUDED.sno
       RETURNING *`,
      [
        id || null, // Let DB generate if null
        sno || 0,
        name,
        phone || "",
        adhaar || "",
        duedate || null,
        gender || "Boys",
        photo || "",
      ]
    );

    res.json(result.rows[0]);
  } catch (e) {
    console.error("POST /players error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// DELETE PLAYER
app.delete("/players/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM players WHERE id = $1", [id]);
    res.json({ success: true, message: "Player deleted" });
  } catch (e) {
    console.error("DELETE /players error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// ========================================
// MATCHES API
// ========================================

// SAVE ONE MATCH RESULT
app.post("/matches", async (req, res) => {
  try {
    const body = req.body;
    const date = body.date || null;
    const category = body.category ? String(body.category) : "";
    const gender = body.gender ? String(body.gender) : "";
    const player1 = body.player1 ? String(body.player1) : "";
    const player2 = body.player2 ? String(body.player2) : "";
    const score1 = body.score1 != null ? Number(body.score1) : null;
    const score2 = body.score2 != null ? Number(body.score2) : null;
    const winner = body.winner
      ? String(body.winner)
      : score1 > score2
      ? player1
      : player2;
    const roundno = body.roundno || body.round || 0;

    // Basic validation
    if (!player1 || !player2) {
      return res
        .status(400)
        .json({ error: "player1 and player2 are required" });
    }

    // Insert into DB
    const q = `INSERT INTO matches (date, category, gender, player1, player2, score1, score2, winner, roundno) 
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) 
               RETURNING *`;
    const vals = [
      date,
      category,
      gender,
      player1,
      player2,
      score1,
      score2,
      winner,
      roundno,
    ];
    const result = await pool.query(q, vals);

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /matches ERROR:", err);
    return res
      .status(500)
      .json({ error: String(err.message ? err.message : err) });
  }
});

// GET MATCHES BY DATE
app.get("/matches", async (req, res) => {
  try {
    const { date } = req.query;
    const result = await pool.query(
      "SELECT * FROM matches WHERE date = $1 ORDER BY id",
      [date]
    );
    res.json(result.rows);
  } catch (e) {
    console.error("GET /matches error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// ========================================
// TOURNAMENT SAVE/LOAD
// ========================================

// SAVE FULL TOURNAMENT JSON
app.post("/tournaments", async (req, res) => {
  try {
    const { date, key, data } = req.body;
    const result = await pool.query(
      "INSERT INTO tournaments (date, key, data) VALUES ($1,$2,$3) RETURNING *",
      [date, key, data]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error("POST /tournaments error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// LOAD TOURNAMENT BY DATE
app.get("/tournaments", async (req, res) => {
  try {
    const { date } = req.query;
    const result = await pool.query(
      "SELECT * FROM tournaments WHERE date = $1",
      [date]
    );
    res.json(result.rows);
  } catch (e) {
    console.error("GET /tournaments error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// DB Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

// -----------------------------------------
// PLAYERS API
// -----------------------------------------

// GET PLAYERS
app.get("/players", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM players ORDER BY id");
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ADD PLAYER
app.post("/players", async (req, res) => {
  try {
    const { name, phone, adhaar, due_date } = req.body;
    const result = await pool.query(
      `INSERT INTO players (name, phone, adhaar, due_date)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, phone, adhaar, due_date]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// -----------------------------------------
// MATCHES API
// -----------------------------------------

// SAVE ONE MATCH RESULT
// Robust POST /matches handler — replace your existing one with this
app.post("/matches", async (req, res) => {
  try {
    // sanitize + defaulting
    const body = req.body || {};
    const date = body.date || null; // expected "YYYY-MM-DD" or null
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

    // Basic validation
    if (!player1 || !player2) {
      return res
        .status(400)
        .json({ error: "player1 and player2 are required" });
    }
    if (player1 === player2) {
      return res
        .status(400)
        .json({ error: "player1 and player2 must be different" });
    }
    if (
      score1 == null ||
      score2 == null ||
      Number.isNaN(score1) ||
      Number.isNaN(score2)
    ) {
      // allow saving match with null scores, but if provided must be numbers
      // If you want to require scores, uncomment the next line:
      // return res.status(400).json({ error: "score1 and score2 must be numbers" });
    }

    // Insert into DB (columns must match your schema)
    const q = `INSERT INTO matches (date, category, gender, player1, player2, score1, score2, winner)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`;
    const vals = [
      date,
      category,
      gender,
      player1,
      player2,
      score1,
      score2,
      winner,
    ];

    const result = await pool.query(q, vals);
    return res.json(result.rows[0]);
  } catch (err) {
    // log full error to terminal for debugging, and return readable message
    console.error("POST /matches ERROR:", err);
    return res
      .status(500)
      .json({ error: String(err && err.message ? err.message : err) });
  }
});

// GET MATCHES BY DATE
app.get("/matches", async (req, res) => {
  try {
    const { date } = req.query;
    const result = await pool.query(
      `SELECT * FROM matches WHERE date = $1 ORDER BY id`,
      [date]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// -----------------------------------------
// TOURNAMENT SAVE/LOAD
// -----------------------------------------

// SAVE FULL TOURNAMENT (JSON)
app.post("/tournaments", async (req, res) => {
  try {
    const { date, key, data } = req.body;

    const result = await pool.query(
      `INSERT INTO tournaments (date, key, data)
       VALUES ($1,$2,$3) RETURNING *`,
      [date, key, data]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// LOAD TOURNAMENT BY DATE
app.get("/tournaments", async (req, res) => {
  try {
    const { date } = req.query;
    const result = await pool.query(
      `SELECT * FROM tournaments WHERE date = $1`,
      [date]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

app.listen(3000, () => {
  console.log("Backend running at http://localhost:3000");
});

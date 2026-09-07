import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool, { initDB } from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// REST API
app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users");
    res.json({ status: "Ok", service: "user-service", users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (rows.length > 0) res.json(rows[0]);
    else res.status(404).json({ message: "User not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = process.env.PORT || 5002;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`User service running on port ${PORT}`);
  });
});

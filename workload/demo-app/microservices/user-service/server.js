import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool, { initDB } from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const toPublicUser = (row) => {
  const address = typeof row.address === "string" ? JSON.parse(row.address) : (row.address || {});
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name || (row.name || "").split(" ")[0] || "",
    lastName: row.last_name || (row.name || "").split(" ").slice(1).join(" ") || "",
    email: row.email,
    phone: row.phone || "",
    image: row.image || "",
    address: {
      address: address.address || "",
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "",
    },
  };
};

app.get("/health", (req, res) => res.json({ status: "Ok", service: "user-service" }));

app.get("/api/users", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users");
    res.json({ status: "Ok", service: "user-service", users: rows.map(toPublicUser) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/api/users/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "username and password are required" });
  }
  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE username = $1 AND password = $2",
      [username, password]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    res.json(toPublicUser(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (rows.length > 0) res.json(toPublicUser(rows[0]));
    else res.status(404).json({ message: "User not found" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = process.env.PORT || 5002;

initDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`User service running on port ${PORT}`);
  });
});

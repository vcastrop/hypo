import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'postgres',
  database: 'user_db',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});

export const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL
      );
    `);

    // Insert mock data if empty
    const { rows } = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO users (id, name, email) VALUES 
        ('1', 'Alice', 'alice@example.com'),
        ('2', 'Bob', 'bob@example.com');
      `);
    }
    console.log("Connected to PostgreSQL (user_db) and initialized tables");
  } catch (err) {
    console.error("Error initializing user_db", err);
  } finally {
    client.release();
  }
};

export default pool;

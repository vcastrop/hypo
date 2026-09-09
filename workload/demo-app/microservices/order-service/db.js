import pg from 'pg';
const { Pool } = pg;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'postgres',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});

export const initDB = async (retries = 30) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            total DECIMAL(10,2) NOT NULL,
            status VARCHAR(50) DEFAULT 'confirmed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
            book_id VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            quantity INTEGER DEFAULT 1
          );
        `);
        await client.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
        console.log('Connected to PostgreSQL and initialized tables');
      } finally {
        client.release();
      }
      return;
    } catch (err) {
      console.error(`order_db not ready (${attempt}/${retries}):`, err.message);
      if (attempt === retries) throw err;
      await sleep(2000);
    }
  }
};

export default pool;

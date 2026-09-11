import pg from 'pg';
const { Pool } = pg;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'postgres',
  database: process.env.DB_NAME || 'user_db',
  password: process.env.DB_PASS || 'postgres',
  port: process.env.DB_PORT || 5432,
});

export const initDB = async (retries = 30) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255)
          );
        `);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(255)`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT`);
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address JSONB`);

        await client.query(
          `INSERT INTO users (id, username, password, first_name, last_name, name, email, phone, image, address)
           VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb),
           ($11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb)
           ON CONFLICT (id) DO UPDATE SET
             username = EXCLUDED.username,
             password = EXCLUDED.password,
             first_name = EXCLUDED.first_name,
             last_name = EXCLUDED.last_name,
             name = EXCLUDED.name,
             email = EXCLUDED.email,
             phone = EXCLUDED.phone,
             image = EXCLUDED.image,
             address = EXCLUDED.address`,
          [
            '1', 'emilys', 'emilyspass', 'Emily', 'Smith', 'Emily Smith', 'emily@example.com',
            '555-0101', 'https://i.pravatar.cc/150?u=emilys',
            JSON.stringify({
              address: '123 Main St', city: 'Bogotá', state: 'Cundinamarca',
              postalCode: '110111', country: 'Colombia',
            }),
            '2', 'bob', 'bobpass', 'Bob', 'Jones', 'Bob Jones', 'bob@example.com',
            '555-0102', 'https://i.pravatar.cc/150?u=bob',
            JSON.stringify({
              address: '456 Side Ave', city: 'Medellín', state: 'Antioquia',
              postalCode: '050001', country: 'Colombia',
            }),
          ]
        );
        console.log('Connected to PostgreSQL (user_db) and initialized tables');
      } finally {
        client.release();
      }
      return;
    } catch (err) {
      console.error(`user_db not ready (${attempt}/${retries}):`, err.message);
      if (attempt === retries) throw err;
      await sleep(2000);
    }
  }
};

export default pool;

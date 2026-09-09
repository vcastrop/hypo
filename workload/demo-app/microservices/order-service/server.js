import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool, { initDB } from "./db.js";
import { getBookById, clearCart } from "./grpcClient.js";

dotenv.config();

const COMM_MODE = process.env.COMM_MODE || "rest";
console.log(`Order service communication mode: ${COMM_MODE}`);

const app = express();
app.use(cors());
app.use(express.json());

const toOrderDto = (order) => ({
  ...order,
  date: order.created_at || order.date,
  items: (order.items || []).map((item) => ({
    ...item,
    name: item.name || `Book ${item.book_id}`,
  })),
});

app.get("/health", (req, res) => res.json({ status: "Ok", service: "order-service" }));

app.get("/api/orders/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const { rows: orders } = await pool.query(
      "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    for (const order of orders) {
      const { rows: items } = await pool.query(
        "SELECT * FROM order_items WHERE order_id = $1",
        [order.id]
      );
      order.items = items;
    }

    res.json(orders.map(toOrderDto));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/api/orders", async (req, res) => {
  const { userId, items } = req.body;

  if (!userId || !items || items.length === 0) {
    return res.status(400).json({ message: "userId and items are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let total = 0;
    const enrichedItems = [];

    for (const item of items) {
      let bookPrice = parseFloat(String(item.price || 0).replace("$", "")) || 0;
      let bookName = item.name || "";

      if (COMM_MODE === "grpc") {
        try {
          const book = await getBookById(item.book_id || item.id);
          if (book.found) {
            bookPrice = parseFloat(String(book.price).replace("$", "")) || bookPrice;
            bookName = book.name || bookName;
          }
        } catch (grpcErr) {
          console.error("gRPC GetBook error (continuing with provided data):", grpcErr.message);
        }
      }

      const qty = item.quantity || 1;
      total += bookPrice * qty;
      enrichedItems.push({
        ...item,
        book_id: item.book_id || item.id,
        price: bookPrice,
        name: bookName,
        quantity: qty,
      });
    }

    const orderRes = await client.query(
      "INSERT INTO orders (user_id, total, status) VALUES ($1, $2, $3) RETURNING *",
      [userId, total.toFixed(2), "confirmed"]
    );
    const orderId = orderRes.rows[0].id;

    for (const item of enrichedItems) {
      await client.query(
        "INSERT INTO order_items (order_id, book_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)",
        [orderId, item.book_id, item.name || "", item.price || 0, item.quantity || 1]
      );
    }

    await client.query("COMMIT");

    if (COMM_MODE === "grpc") {
      try {
        const clearResult = await clearCart(userId);
        console.log(`Cart cleared for user ${userId}:`, clearResult.message);
      } catch (grpcErr) {
        console.error("gRPC ClearCart error (order already created):", grpcErr.message);
      }
    }

    const finalOrder = toOrderDto({ ...orderRes.rows[0], items: enrichedItems });
    res.status(201).json({ message: "Order created", order: finalOrder });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  } finally {
    client.release();
  }
});

app.get("/api/orders/:userId/:orderId", async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE id = $1 AND user_id = $2",
      [orderId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = rows[0];
    const { rows: items } = await pool.query(
      "SELECT * FROM order_items WHERE order_id = $1",
      [orderId]
    );
    order.items = items;

    res.json(toOrderDto(order));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = process.env.PORT || 5004;

initDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Order service running on port ${PORT}`);
  });
});

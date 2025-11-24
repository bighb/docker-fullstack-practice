const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { createClient } = require("redis");

const app = express();
const PORT = process.env.PORT || 5001;

// 中间件
app.use(cors());
app.use(express.json());

// PostgreSQL 连接
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres123",
  database: process.env.DB_NAME || "myapp",
});

// Redis 连接
const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

// 初始化连接
(async () => {
  try {
    await redisClient.connect();
    console.log("✅ Connected to Redis");

    const dbResult = await pool.query("SELECT NOW()");
    console.log("✅ Connected to PostgreSQL:", dbResult.rows[0].now);
  } catch (error) {
    console.error("❌ Connection error:", error);
  }
})();

// 路由
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// 获取所有用户
app.get("/api/users", async (req, res) => {
  try {
    // 尝试从 Redis 获取缓存
    const cached = await redisClient.get("users");
    if (cached) {
      console.log("📦 Returning cached data");
      return res.json({ source: "cache", data: JSON.parse(cached) });
    }

    // 从数据库查询
    const result = await pool.query(
      "SELECT * FROM users ORDER BY created_at DESC"
    );

    // 缓存结果
    await redisClient.setEx("users", 60, JSON.stringify(result.rows));

    res.json({ source: "database", data: result.rows });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 创建用户
app.post("/api/users", async (req, res) => {
  try {
    const { name, email } = req.body;
    const result = await pool.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
      [name, email]
    );

    // 清除缓存
    await redisClient.del("users");

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 统计接口访问次数
app.get("/api/stats", async (req, res) => {
  try {
    const count = await redisClient.incr("api_visits");
    res.json({ totalVisits: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});

// 优雅关闭
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, closing connections...");
  await redisClient.quit();
  await pool.end();
  process.exit(0);
});

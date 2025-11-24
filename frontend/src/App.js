import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

function App() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ totalVisits: 0 });
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      setUsers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/stats`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/users`, formData);
      setFormData({ name: "", email: "" });
      fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🐳 Docker 全栈练习项目</h1>
        <p>React + Node.js + PostgreSQL + Redis</p>
        <div className="stats">
          <span>API 访问次数: {stats.totalVisits}</span>
        </div>
      </header>

      <main className="container">
        <section className="form-section">
          <h2>添加新用户</h2>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="姓名"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
            <input
              type="email"
              placeholder="邮箱"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "添加中..." : "添加用户"}
            </button>
          </form>
        </section>

        <section className="users-section">
          <h2>用户列表</h2>
          <div className="users-grid">
            {users.length === 0 ? (
              <p>暂无用户数据</p>
            ) : (
              users.map((user) => (
                <div key={user.id} className="user-card">
                  <h3>{user.name}</h3>
                  <p>{user.email}</p>
                  <small>
                    {new Date(user.created_at).toLocaleString("zh-CN")}
                  </small>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

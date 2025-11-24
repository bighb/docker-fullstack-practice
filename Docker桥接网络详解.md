# Docker 桥接网络详解

> 这篇文档用最通俗的方式，帮你彻底搞懂 Docker 的桥接网络。

---

## 一、先打个比方

想象一下，你住在一个**小区**里：

- **小区** = Docker 的桥接网络（bridge network）
- **每栋楼** = 每个容器（backend、postgres、redis...）
- **楼号** = 服务名（postgres、backend、redis）
- **小区大门** = 端口映射（ports）

**关键点来了**：

> 小区里的住户（容器）互相串门，直接喊楼号就行，根本不用出小区大门！
>
> 只有小区外面的人（宿主机上的程序）想进来，才需要走大门（端口映射）。

---

## 二、图解：两种访问方式

### 场景图

```
┌─────────────────────────────────────────────────────────────────┐
│                        宿主机 (你的 Mac)                         │
│                                                                 │
│    ┌──────────────────┐                                         │
│    │   数据库工具      │                                         │
│    │  (DBeaver等)     │                                         │
│    │                  │                                         │
│    │ 连接地址:        │                                         │
│    │ localhost:5433   │ ─────┐                                  │
│    └──────────────────┘      │                                  │
│                              │ 走「小区大门」                     │
│                              │ (端口映射)                        │
│                              ↓                                  │
│    ┌────────────────────────────────────────────────────────┐   │
│    │                                                        │   │
│    │            Docker 桥接网络 (app-network)                │   │
│    │                 「小区内部」                             │   │
│    │                                                        │   │
│    │   ┌─────────────┐              ┌─────────────┐         │   │
│    │   │             │   直接喊     │             │         │   │
│    │   │   backend   │ ──────────→ │  postgres   │         │   │
│    │   │   (后端)    │  楼号就行    │  (数据库)    │         │   │
│    │   │             │             │             │         │   │
│    │   │ 连接地址:   │ postgres:5432│  内部端口:  │         │   │
│    │   │             │ 不走大门！   │    5432     │         │   │
│    │   └─────────────┘              └─────────────┘         │   │
│    │         │                            ↑                 │   │
│    │         │         ┌─────────────┐    │                 │   │
│    │         │         │             │    │                 │   │
│    │         └───────→ │    redis    │ ←──┘                 │   │
│    │           redis:6379  (缓存)                           │   │
│    │                   └─────────────┘                      │   │
│    │                                                        │   │
│    └────────────────────────────────────────────────────────┘   │
│                              ↑                                  │
│                              │                                  │
│                      端口映射 5433:5432                          │
│                      (小区大门)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 两条路径对比

```
路径 A：容器 → 容器（小区内部串门）
═══════════════════════════════════════════════════
   backend 容器                    postgres 容器
  ┌───────────┐                  ┌───────────┐
  │           │   postgres:5432  │           │
  │  Node.js  │ ───────────────→ │ PostgreSQL│
  │           │   直接走内网      │   :5432   │
  └───────────┘                  └───────────┘

  特点：快速、直接、不经过宿主机


路径 B：宿主机 → 容器（外人进小区）
═══════════════════════════════════════════════════
   宿主机                              postgres 容器
  ┌───────────┐                      ┌───────────┐
  │           │   localhost:5433     │           │
  │  DBeaver  │ ──────────────────→  │ PostgreSQL│
  │           │   必须走端口映射      │   :5432   │
  └───────────┘                      └───────────┘

  特点：需要配置 ports，走宿主机网络栈
```

---

## 三、核心配置代码对比

### docker-compose.yml 配置

```yaml
# 定义桥接网络（创建"小区"）
networks:
  app-network:          # 网络名称，相当于小区名
    driver: bridge      # 桥接模式，容器间可互通

services:
  # 数据库服务（小区里的一栋楼）
  postgres:
    image: postgres:15-alpine
    container_name: fullstack_postgres
    ports:
      - "5433:5432"     # 重点！这是「小区大门」
                        # 左边 5433 = 宿主机端口（大门外的门牌号）
                        # 右边 5432 = 容器端口（楼内的房间号）
    networks:
      - app-network     # 加入小区

  # 后端服务（小区里的另一栋楼）
  backend:
    build: ./backend
    container_name: fullstack_backend
    environment:
      DB_HOST: postgres  # 直接用服务名！不是 localhost
      DB_PORT: 5432      # 容器内部端口！不是 5433
    networks:
      - app-network      # 同一个小区，可以直接串门
```

### 后端代码配置

```javascript
// backend/src/index.js

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',     // 容器内用 'postgres'
  port: process.env.DB_PORT || 5432,            // 容器内部端口 5432
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  database: process.env.DB_NAME || 'myapp',
});
```

### .env 环境变量配置

```bash
# 数据库连接配置
DB_HOST=postgres    # 服务名，不是 localhost 或 IP
DB_PORT=5432        # 容器内部端口，不是宿主机映射端口 5433！
DB_USER=postgres
DB_PASSWORD=postgres123
DB_NAME=myapp
```

---

## 四、常见误解澄清

### 误解：后端连数据库要走宿主机端口？

很多同学会这样想：

```
错误理解 ❌
═══════════════════════════════════════════════════════════════

"后端要连数据库，端口映射是 5433:5432..."
"那后端应该连 localhost:5433，然后映射到容器的 5432..."

  backend ──→ localhost:5433 ──→ 映射 ──→ postgres:5432
              (宿主机)              ↑
                                   │
                            这一步是多余的！
```

**正确理解**：

```
正确理解 ✅
═══════════════════════════════════════════════════════════════

后端和数据库都在同一个 Docker 网络里（app-network）
它们是「邻居」，直接敲门就行，不用绕到小区外面！

  backend ──────────────────────→ postgres:5432
           直接通过服务名访问
           根本不经过宿主机！
```

### 配置对比表

| 场景 | DB_HOST | DB_PORT | 说明 |
|------|---------|---------|------|
| **容器内访问**（正确） | `postgres` | `5432` | 通过 Docker 网络直接访问 |
| **误解的配置**（错误） | `localhost` | `5433` | 绕远路，而且在容器内 localhost 是容器自己！ |
| **宿主机工具访问** | `localhost` | `5433` | DBeaver 等工具需要走端口映射 |

### 为什么误解会导致连接失败？

```
如果在容器内配置 DB_HOST=localhost...

  ┌─────────────────────────────────┐
  │         backend 容器            │
  │                                 │
  │  DB_HOST=localhost              │
  │         │                       │
  │         ↓                       │
  │  localhost 指向的是容器自己！    │
  │  容器内没有运行 PostgreSQL！     │
  │                                 │
  │  结果：Connection Refused ❌    │
  └─────────────────────────────────┘
```

---

## 五、实际场景举例

### 场景 1：本地 PostgreSQL 端口冲突

**问题**：本地已安装 PostgreSQL，占用了 5432 端口

**解决**：只改宿主机映射端口

```yaml
# docker-compose.yml
postgres:
  ports:
    - "5433:5432"   # 宿主机用 5433，避开本地 PostgreSQL
```

```bash
# .env - 不需要改！
DB_HOST=postgres
DB_PORT=5432        # 仍然是 5432，因为容器内部端口没变
```

**结果**：
- 本地 PostgreSQL：`localhost:5432`
- Docker PostgreSQL：`localhost:5433`（仅供宿主机工具使用）
- 后端容器连接：`postgres:5432`（走内部网络）

### 场景 2：完全不暴露数据库端口

如果你不需要用 DBeaver 等工具直接连数据库，可以完全不映射：

```yaml
postgres:
  # ports:          # 注释掉或删除
  #   - "5432:5432"
  networks:
    - app-network   # 只要在同一网络，容器间就能通信
```

这样更安全，数据库完全隔离在 Docker 网络内。

### 场景 3：多个数据库实例

```yaml
services:
  postgres-main:
    image: postgres:15-alpine
    ports:
      - "5432:5432"     # 主数据库
    networks:
      - app-network

  postgres-test:
    image: postgres:15-alpine
    ports:
      - "5433:5432"     # 测试数据库，宿主机用 5433
    networks:
      - app-network
```

后端连接时：
- 连主库：`DB_HOST=postgres-main`, `DB_PORT=5432`
- 连测试库：`DB_HOST=postgres-test`, `DB_PORT=5432`

注意：两个库的 `DB_PORT` 都是 5432，因为这是容器内部端口！

---

## 六、总结：一张表搞清楚

| 概念 | 比喻 | 作用 |
|------|------|------|
| **bridge 网络** | 小区 | 让容器们住在一起，互相能找到 |
| **服务名** | 楼号 | 容器间互相访问的地址（postgres、redis） |
| **容器端口** | 房间号 | 服务在容器内监听的端口（5432） |
| **端口映射 ports** | 小区大门 | 让外面的人（宿主机）能进来访问 |
| **宿主机端口** | 大门外的门牌号 | 外部访问时使用的端口（5433） |

### 记住这个口诀

> **容器之间用服务名，端口用容器内部的。**
> **宿主机访问走映射，左边端口才是它的。**

```yaml
ports:
  - "5433:5432"
     │     │
     │     └── 容器端口（容器间用这个）
     └── 宿主机端口（外部访问用这个）
```

---

## 七、动手验证

学完了，来验证一下你的理解：

```bash
# 1. 查看 Docker 网络
docker network ls
docker network inspect docker-fullstack-practice_app-network

# 2. 从后端容器内 ping 数据库（用服务名）
docker exec fullstack_backend ping postgres -c 2

# 3. 从后端容器内访问数据库（用服务名 + 容器端口）
docker exec fullstack_backend sh -c "nc -zv postgres 5432"

# 4. 从宿主机访问数据库（用 localhost + 映射端口）
nc -zv localhost 5433
```

如果都通了，说明你已经彻底搞懂 Docker 桥接网络了！

🎓 Docker 全栈项目知识详解

📁 一、项目整体架构

     docker-fullstack-practice/
     ├── docker-compose.yml      # 多容器编排配置（核心）
     ├── .dockerignore           # 构建时忽略的文件
     ├── .env.example            # 环境变量模板
     ├── Makefile                # 命令简化工具
     ├── README.md               # 项目文档
     ├── backend/                # 后端服务
     ├── frontend/               # 前端服务
     ├── database/               # 数据库初始化脚本
     └── nginx/                  # 反向代理配置

🏗️ 架构设计理念

这是一个微服务架构的全栈应用，包含 5 个独立容器：

     - Frontend (React) → 用户界面
     - Backend (Node.js) → API 服务
     - PostgreSQL → 关系型数据库
     - Redis → 缓存层
     - Nginx → 反向代理 / 负载均衡

---

---

🐳 二、docker-compose.yml 深度解析

1️⃣ 版本声明

     version: '3.8'

     - 使用 Docker Compose 文件格式版本 3.8
     - 支持所有现代 Docker 特性

2️⃣ 服务定义 (Services

🗄️ PostgreSQL 数据库服务

     postgres:
       image: postgres:15-alpine          # 使用轻量级 Alpine 版本
       container_name: fullstack_postgres  # 容器名称
       environment:                        # 环境变量配置
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgres123
         POSTGRES_DB: myapp
       ports:
         - "5432:5432"                    # 端口映射：宿主机:容器
       volumes:
         - postgres_data:/var/lib/postgresql/data  # 数据持久化
         - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql  #

初始化脚本
networks: - app-network # 加入自定义网络
healthcheck: # 健康检查
test: ["CMD-SHELL", "pg_isready -U postgres"]
interval: 10s
timeout: 5s
retries: 5

知识点：

     - Alpine Linux：比标准镜像小 90%，推荐用于生产环境
     - Volumes：数据持久化，即使容器删除数据也保留
     - Healthcheck：确保数据库完全启动后再启动依赖服务
     - 初始化脚本：/docker-entrypoint-initdb.d/

目录下的脚本会在首次启动时自动执行

📦 Redis 缓存服务

     redis:
       image: redis:7-alpine
       healthcheck:
         test: ["CMD", "redis-cli", "ping"]  # 使用 PING 命令检查

知识点：

     - Redis 用于缓存用户列表，减少数据库查询
     - redis-cli ping 返回 PONG 表示服务正常

🔧 Node.js 后端服务

     backend:
       build:
         context: ./backend
         dockerfile: Dockerfile
       environment:
         DB_HOST: postgres              # 容器名即为主机名
         REDIS_HOST: redis
       volumes:
         - ./backend/src:/app/src       # 热重载：代码修改实时生效
         - /app/node_modules            # 匿名卷：避免覆盖容器内的依赖
       depends_on:
         postgres:
           condition: service_healthy   # 等待数据库健康检查通过
         redis:
           condition: service_healthy

核心知识：

     - 容器间通信：在同一网络中，容器名 = DNS 名称
       - 后端通过 postgres:5432 连接数据库
       - 不是 localhost！每个容器有独立网络栈
     - Volume 映射技巧：  - ./backend/src:/app/src    # 绑定挂载：本地代码 →

容器 - /app/node_modules # 匿名卷：保护容器内的 node_modules

     第二行防止宿主机的 node_modules 覆盖容器内的依赖
     - depends_on + condition：
       - 传统 depends_on 只保证启动顺序
       - 加上 condition: service_healthy 确保服务真正可用

⚛️ React 前端服务

     frontend:
       build:
         context: ./frontend
         target: development           # 多阶段构建：只构建到 development 阶段
       environment:
         - REACT_APP_API_URL=http://localhost:5001

知识点：

     - target: development 指定 Dockerfile 中的构建阶段
     - React 环境变量必须以 REACT_APP_ 开头

🌐 Nginx 反向代理

     nginx:
       volumes:
         - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro  # :ro = 只读模式

作用：

     - 统一入口：前端和后端都通过 80 端口访问
     - 负载均衡：可扩展多个后端实例
     - 静态资源优化：直接由 Nginx 提供前端文件

3️⃣ 数据卷定义 (Volumes

     volumes:
       postgres_data:
         driver: local
       redis_data:
         driver: local

知识点：

     - 命名卷 vs 绑定挂载：
       - 命名卷：postgres_data:/var/lib/postgresql/data (由 Docker 管理)
       - 绑定挂载：./backend/src:/app/src (直接映射宿主机目录)
     - 命名卷存储位置：/var/lib/docker/volumes/ (Linux)

4️⃣ 网络定义 (Networks

     networks:
       app-network:
         driver: bridge

知识点：

     - Bridge 网络：默认网络驱动，适合单机多容器
     - 同一网络内容器可通过容器名互相访问
     - 与宿主机网络隔离，需要端口映射 (ports) 才能从外部访问

---

---

📦 三、Dockerfile 多阶段构建详解

🔧 后端 Dockerfile 解析

     # 阶段 1: 基础镜像
     FROM node:18-alpine AS base
     WORKDIR /app
     COPY package*.json ./

     # 阶段 2: 开发环境
     FROM base AS development
     RUN npm install              # 安装所有依赖（包括 devDependencies）
     COPY . .
     CMD ["npm", "run", "dev"]    # 使用 nodemon 热重载

     # 阶段 3: 生产构建
     FROM base AS builder
     RUN npm ci --only=production # 只安装生产依赖，更快更安全
     COPY . .

     # 阶段 4: 生产环境（最小化镜像）
     FROM node:18-alpine AS production
     WORKDIR /app
     ENV NODE_ENV=production

     # 安全：创建非 root 用户
     RUN addgroup -g 1001 -S nodejs && \
         adduser -S nodejs -u 1001

     # 从 builder 阶段复制文件
     COPY --from=builder --chown=nodejs:nodejs /app/node_modules

./node_modules
COPY --chown=nodejs:nodejs . .

     USER nodejs                  # 切换到普通用户
     HEALTHCHECK --interval=30s --timeout=3s \
       CMD node -e "require('http').get('http://localhost:5001/api/health',

..."

多阶段构建优势：

     - 镜像体积减少 60-80%：
       - 开发镜像包含编译工具、测试依赖
       - 生产镜像只包含运行时文件
     - 安全性提升：
       - 非 root 用户运行
       - 不包含源代码的 .git、node_modules 中的开发依赖
     - 构建缓存优化：
       - 先 COPY package.json，利用 Docker 层缓存
       - 依赖未变化时跳过 npm install

⚛️ 前端 Dockerfile 解析

     # 开发环境
     FROM node:18-alpine AS development
     RUN npm install
     CMD ["npm", "start"]         # React 开发服务器 (端口 3000)

     # 构建阶段
     FROM node:18-alpine AS builder
     RUN npm ci
     RUN npm run build            # 生成静态文件到 /app/build

     # 生产环境：切换到 Nginx
     FROM nginx:alpine AS production
     COPY --from=builder /app/build /usr/share/nginx/html
     EXPOSE 80
     CMD ["nginx", "-g", "daemon off;"]

知识点：

     - React 生产部署：
       - 开发模式：Node.js 服务器 + 热重载
       - 生产模式：静态文件 + Nginx 托管
     - 镜像体积对比：
       - 开发镜像：~400MB (Node.js + 源码)
       - 生产镜像：~25MB (Nginx + 静态文件)

---

---

🔗 四、容器网络通信原理

🌐 容器名解析机制

在 app-network 中：

     // backend/src/index.js
     const pool = new Pool({
       host: 'postgres',  // ← 直接使用容器名！
       port: 5432
     });

Docker 内置 DNS：

     - Docker 为每个网络运行 DNS 服务器 (127.0.0.11)
     - 自动将容器名解析为内部 IP
     - 示例：postgres → 172.20.0.2

📊 网络隔离与端口映射

     ports:
       - "5432:5432"    # 宿主机端口:容器端口

     - 外部访问：localhost:5432 → Docker 宿主机 → 容器
     - 容器间访问：postgres:5432 → 直接通过内部网络

---

---

💾 五、数据持久化策略

📂 三种挂载方式对比

┌──────────┬────────────────────────────────────────┬─────────────┬────────
──────┐
│ 类型 │ 语法 │ 存储位置 │ 用途
│
├──────────┼────────────────────────────────────────┼─────────────┼────────
──────┤
│ 命名卷 │ postgres_data:/var/lib/postgresql/data │ Docker 管理 │
数据库数据 │
├──────────┼────────────────────────────────────────┼─────────────┼────────
──────┤
│ 绑定挂载 │ ./backend/src:/app/src │ 宿主机目录 │
代码热重载 │
├──────────┼────────────────────────────────────────┼─────────────┼────────
──────┤
│ 匿名卷 │ /app/node_modules │ 临时存储 │
保护容器文件 │
└──────────┴────────────────────────────────────────┴─────────────┴────────
──────┘

🔍 Volume 实战命令

     # 查看所有卷
     docker volume ls

     # 查看卷详情（包括实际存储位置）
     docker volume inspect docker-fullstack-practice_postgres_data

     # 备份数据
     docker run --rm \
       -v docker-fullstack-practice_postgres_data:/data \
       -v $(pwd):/backup \
       alpine tar czf /backup/postgres-backup.tar.gz /data

     # 删除所有未使用的卷
     docker volume prune

---

---

🔧 六、环境变量管理

🔐 三种配置方式

     - docker-compose.yml 直接定义：

     environment:
       NODE_ENV: development
       PORT: 5001

     - 使用 .env 文件：

     # .env
     DB_PASSWORD=super_secret_123

     environment:
       DB_PASSWORD: ${DB_PASSWORD}

     - env_file 引用：

     env_file:
       - ./backend/.env

⚠️ 安全最佳实践

     - ❌ 不要提交 .env 到 Git
     - ✅ 提供 .env.example 作为模板
     - ✅ 生产环境使用 Docker Secrets 或 Vault

---

---

🏥 七、健康检查机制

     healthcheck:
       test: ["CMD-SHELL", "pg_isready -U postgres"]
       interval: 10s       # 每 10 秒检查一次
       timeout: 5s         # 超过 5 秒视为失败
       retries: 5          # 失败 5 次后标记为 unhealthy
       start_period: 30s   # 启动后 30 秒内失败不计入 retries

监控容器健康状态：

     docker-compose ps                # 查看 STATUS 列
     docker inspect --format='{{.State.Health.Status}}' fullstack_postgres

---

---

🚀 八、启动流程详解

     docker-compose up -d

执行步骤：

     - 创建网络 app-network
     - 创建卷 postgres_data, redis_data
     - 构建镜像（如果不存在）
       - 拉取基础镜像 (node:18-alpine, postgres:15-alpine...)
       - 执行 Dockerfile 指令
     - 按依赖顺序启动容器：
       - postgres, redis（无依赖，并行启动）
       - 等待健康检查通过
       - backend（depends_on postgres, redis）
       - frontend（depends_on backend）
       - nginx（depends_on frontend, backend）

---

---

📊 九、实用调试技巧

🔍 日志查看

     docker-compose logs -f backend               # 实时查看后端日志
     docker-compose logs --tail=100 postgres      # 查看最后 100 行
     docker logs fullstack_backend 2>&1 | grep ERROR  # 过滤错误日志

🐚 进入容器调试

     docker-compose exec backend sh               # 进入后端容器
     docker-compose exec postgres psql -U postgres -d myapp  # 直接执行 SQL

🔧 网络诊断

     # 从 backend 容器 ping postgres
     docker-compose exec backend ping postgres

     # 查看网络详情
     docker network inspect docker-fullstack-practice_app-network

📦 镜像优化检查

     # 查看镜像层历史
     docker history docker-fullstack-practice_backend

     # 分析镜像体积
     docker images | grep fullstack

---

---

🎯 十、学习建议

第 1 天：基础操作

     - ✅ 理解 docker-compose.yml 每一行含义
     - ✅ 实践启动/停止/重启容器
     - ✅ 查看日志排查问题

第 2 天：网络通信

     - ✅ 修改后端代码，观察热重载
     - ✅ 进入 backend 容器，测试连接 postgres
     - ✅ 理解容器名如何解析为 IP

第 3 天：数据持久化

     - ✅ 删除容器后数据是否保留？
     - ✅ 备份和恢复数据库
     - ✅ 清理所有数据重新开始

第 4 天：Dockerfile 优化

     - ✅ 对比多阶段构建前后的镜像大小
     - ✅ 修改 Dockerfile 添加新依赖
     - ✅ 理解构建缓存机制

# Dockerfile 与 docker-compose 配合使用详解

## 📖 前言

**一句话总结两者关系**：
- **Dockerfile** = 定义"如何构建单个镜像"（Build Time）
- **docker-compose** = 定义"如何运行一个或多个容器"（Runtime）

**类比理解**：
- Dockerfile 就像"食谱"，告诉你如何制作一道菜
- docker-compose 就像"宴会菜单"，告诉你这顿饭要做哪几道菜、按什么顺序上菜

---

## 🎯 一、职责分工原则

### 1.1 Dockerfile 的职责（构建阶段）

Dockerfile 关注**如何打包应用**：

```dockerfile
# ✅ Dockerfile 应该包含的内容
FROM node:18-alpine           # 选择基础镜像
WORKDIR /app                  # 设置工作目录
COPY package*.json ./         # 复制依赖文件
RUN npm install --production  # 安装依赖
COPY . .                      # 复制源代码
EXPOSE 3000                   # 声明容器监听的端口（文档作用）
CMD ["node", "server.js"]     # 默认启动命令
```

**Dockerfile 的核心职责**：
- 选择基础镜像（FROM）
- 安装系统依赖（RUN apt-get）
- 安装应用依赖（RUN npm install）
- 复制源代码（COPY）
- 设置工作目录（WORKDIR）
- 声明默认启动命令（CMD/ENTRYPOINT）
- 声明监听端口（EXPOSE，仅文档作用）

### 1.2 docker-compose 的职责（运行阶段）

docker-compose 关注**如何运行和编排容器**：

```yaml
# ✅ docker-compose.yml 应该包含的内容
services:
  backend:
    build: ./backend              # 使用 Dockerfile 构建
    ports:
      - "3000:3000"               # 端口映射（宿主机:容器）
    environment:
      - NODE_ENV=production       # 环境变量
      - DB_HOST=postgres          # 数据库地址
    volumes:
      - ./data:/app/data          # 数据卷挂载
    depends_on:
      - postgres                  # 依赖关系
    networks:
      - app-network               # 网络配置
```

**docker-compose 的核心职责**：
- 定义多个服务及其关系（services）
- 端口映射到宿主机（ports）
- 环境变量配置（environment）
- 数据卷挂载（volumes）
- 服务依赖关系（depends_on）
- 网络配置（networks）
- 容器启动顺序和重启策略（restart）

### 1.3 配置应该写在哪里？决策树

```
配置项
├─ 构建时需要的 ➜ Dockerfile
│  ├─ 安装依赖
│  ├─ 复制文件
│  └─ 设置工作目录
│
└─ 运行时需要的 ➜ docker-compose.yml
   ├─ 端口映射（宿主机访问）
   ├─ 环境变量（可变配置）
   ├─ 数据卷挂载
   ├─ 服务编排
   └─ 网络配置
```

**黄金原则**：
1. **Dockerfile 定义"标准镜像"**：不包含环境特定的配置
2. **docker-compose 定义"运行环境"**：根据不同环境（开发/生产）调整配置

---

## 🔧 二、单服务项目：两种方式完整对比

### 场景：部署一个 Node.js API 服务

#### 方式 A：纯 Dockerfile（不使用 docker-compose）

**1. 编写 Dockerfile**

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --production

# 复制源代码
COPY . .

# 声明端口（文档作用）
EXPOSE 3000

# 设置环境变量（可选，建议在运行时设置）
ENV NODE_ENV=production

# 启动命令
CMD ["node", "server.js"]
```

**2. 手动构建和运行**

```bash
# 构建镜像
docker build -t my-api:latest ./backend

# 运行容器（需要手动指定所有配置）
docker run -d \
  --name my-api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=localhost \
  -e DB_PORT=5432 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  my-api:latest
```

**优点**：
- ✅ 简单直接，不需要额外文件
- ✅ 适合快速测试单个服务

**缺点**：
- ❌ 运行命令过长，难以维护
- ❌ 环境变量、端口等配置分散
- ❌ 无法管理多个容器
- ❌ 每次运行都要输入一长串命令

---

#### 方式 B：Dockerfile + docker-compose（推荐）

**1. 编写 Dockerfile（同上）**

```dockerfile
# backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

**2. 编写 docker-compose.yml**

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend        # Dockerfile 所在目录
      dockerfile: Dockerfile    # Dockerfile 文件名（可省略）
    image: my-api:latest        # 构建后的镜像名
    container_name: my-api      # 容器名称
    ports:
      - "3000:3000"             # 端口映射
    environment:
      NODE_ENV: production      # 环境变量
      DB_HOST: localhost
      DB_PORT: 5432
    volumes:
      - ./data:/app/data        # 数据卷挂载
    restart: unless-stopped     # 重启策略
```

**3. 一键启动**

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down
```

**优点**：
- ✅ 配置集中在 docker-compose.yml，易于管理
- ✅ 一键启动/停止所有服务
- ✅ 便于版本控制和团队协作
- ✅ 为将来扩展到多服务做好准备

**缺点**：
- ❌ 需要额外的 docker-compose.yml 文件

---

### 🤔 单服务项目该选哪种方式？

| 场景 | 推荐方式 | 理由 |
|------|---------|------|
| **快速测试** | 纯 Dockerfile | 简单快速，适合一次性测试 |
| **开发环境** | Dockerfile + compose | 配置可复用，团队协作友好 |
| **生产环境** | Dockerfile + compose | 配置规范，便于 CI/CD |
| **未来可能多服务** | Dockerfile + compose | 提前规范化，易于扩展 |

**建议**：即使是单服务，也推荐使用 `Dockerfile + docker-compose`，理由：
1. 配置更清晰，易于维护
2. 团队成员可以一键启动，不需要记忆复杂命令
3. 为将来添加数据库、缓存等服务做好准备

---

## 🏢 三、多服务项目：完整示例

### 场景：前后端分离项目（前端 + 后端 + 数据库）

#### 项目结构

```
myproject/
├── frontend/
│   └── Dockerfile          # 前端的 Dockerfile
├── backend/
│   └── Dockerfile          # 后端的 Dockerfile
└── docker-compose.yml      # 统一编排文件
```

#### 1. 前端 Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 生产镜像
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 2. 后端 Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

#### 3. docker-compose.yml（统一编排）

```yaml
version: '3.8'

services:
  # 前端服务
  frontend:
    build:
      context: ./frontend
    image: myproject-frontend:latest
    container_name: frontend
    ports:
      - "8080:80"               # 宿主机 8080 映射到容器 80
    depends_on:
      - backend
    networks:
      - app-network

  # 后端服务
  backend:
    build:
      context: ./backend
    image: myproject-backend:latest
    container_name: backend
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DB_HOST: postgres         # 使用服务名作为主机名
      DB_PORT: 5432
      DB_USER: myuser
      DB_PASSWORD: mypassword
    depends_on:
      - postgres
    networks:
      - app-network

  # 数据库服务
  postgres:
    image: postgres:15-alpine   # 直接使用官方镜像，不需要 Dockerfile
    container_name: postgres
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydb
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

# 定义数据卷
volumes:
  postgres-data:

# 定义网络
networks:
  app-network:
    driver: bridge
```

#### 4. 启动和管理

```bash
# 一键启动所有服务
docker-compose up -d

# 查看所有服务状态
docker-compose ps

# 查看特定服务日志
docker-compose logs -f backend

# 重启特定服务
docker-compose restart backend

# 停止所有服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v
```

---

### 🔍 多服务 vs 单服务的区别

| 配置项 | 单服务 | 多服务 |
|--------|--------|--------|
| **Dockerfile 数量** | 1 个 | 每个自定义服务 1 个 |
| **docker-compose** | 可选 | 必需 |
| **服务通信** | 无需考虑 | 通过服务名（如 `postgres`） |
| **依赖关系** | 无 | 使用 `depends_on` |
| **网络配置** | 无需定义 | 统一网络（`networks`） |
| **数据持久化** | 单个数据卷 | 多个命名数据卷 |

---

## ⚙️ 四、配置覆盖关系详解

### 4.1 docker-compose 如何使用 Dockerfile

```yaml
services:
  backend:
    # 方式 1: 使用 Dockerfile 构建
    build:
      context: ./backend        # Dockerfile 所在目录
      dockerfile: Dockerfile    # Dockerfile 文件名
      args:                     # 传递构建参数（ARG）
        - NODE_VERSION=18

    # 方式 2: 使用已有镜像
    # image: my-api:latest

    # 方式 3: 同时指定 build 和 image
    # 会先使用 Dockerfile 构建，然后给镜像打上 image 标签
```

### 4.2 docker-compose 覆盖 Dockerfile 的配置

| Dockerfile 指令 | docker-compose 覆盖 | 优先级 | 说明 |
|----------------|-------------------|-------|------|
| `CMD` | `command` | compose 优先 | compose 的 command 会完全覆盖 CMD |
| `ENTRYPOINT` | `entrypoint` | compose 优先 | compose 可以覆盖 ENTRYPOINT |
| `ENV` | `environment` | compose 优先 | compose 的环境变量会覆盖 ENV |
| `EXPOSE` | `ports` | 不冲突 | EXPOSE 仅文档作用，ports 才真正映射端口 |
| `WORKDIR` | `working_dir` | compose 优先 | 很少在 compose 中覆盖 |
| `USER` | `user` | compose 优先 | 可以在 compose 中切换运行用户 |

#### 示例 1：覆盖 CMD

```dockerfile
# Dockerfile
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
services:
  backend:
    command: ["node", "debug.js"]   # ✅ 覆盖 CMD，运行 debug.js
```

**结果**：容器启动时运行 `node debug.js`，而不是 `server.js`

---

#### 示例 2：覆盖 ENV

```dockerfile
# Dockerfile
ENV NODE_ENV=development
ENV PORT=3000
```

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      NODE_ENV: production    # ✅ 覆盖 NODE_ENV
      DB_HOST: postgres       # ✅ 新增环境变量
      # PORT 未覆盖，仍为 3000
```

**结果**：
- `NODE_ENV=production`（被覆盖）
- `PORT=3000`（保持不变）
- `DB_HOST=postgres`（新增）

---

#### 示例 3：EXPOSE vs ports

```dockerfile
# Dockerfile
EXPOSE 3000   # ⚠️ 仅文档作用，不会真正映射端口
```

```yaml
# docker-compose.yml
services:
  backend:
    ports:
      - "8080:3000"   # ✅ 真正映射端口：宿主机 8080 -> 容器 3000
```

**关键理解**：
- `EXPOSE 3000` 只是告诉开发者"这个容器监听 3000 端口"，**不会自动映射到宿主机**
- `ports: "8080:3000"` 才会真正把容器的 3000 端口映射到宿主机的 8080 端口

---

### 4.3 配置优先级规则

```
运行时 > 构建时

docker run 命令行参数 > docker-compose.yml > Dockerfile
```

**实际案例**：

```dockerfile
# Dockerfile
ENV NODE_ENV=development
```

```yaml
# docker-compose.yml
environment:
  NODE_ENV: production
```

```bash
# 命令行覆盖
docker-compose run -e NODE_ENV=test backend
```

**最终结果**：`NODE_ENV=test`（命令行参数优先级最高）

---

## 📋 五、配置项应该写在哪里？最佳实践表

| 配置项 | 写在 Dockerfile | 写在 docker-compose | 理由 |
|-------|---------------|-------------------|------|
| **基础镜像** | ✅ `FROM` | ❌ | 构建时决定 |
| **安装依赖** | ✅ `RUN npm install` | ❌ | 构建时执行 |
| **复制代码** | ✅ `COPY` | ❌ | 构建时打包 |
| **默认启动命令** | ✅ `CMD` | 🟡 需要时用 `command` 覆盖 | Dockerfile 提供默认值 |
| **端口映射** | ❌ | ✅ `ports` | 运行时决定宿主机端口 |
| **环境变量** | 🟡 `ENV`（默认值） | ✅ `environment`（环境特定） | 灵活性优先 |
| **数据卷挂载** | ❌ | ✅ `volumes` | 运行时决定存储位置 |
| **服务依赖** | ❌ | ✅ `depends_on` | 仅多服务场景 |
| **网络配置** | ❌ | ✅ `networks` | 运行时编排 |
| **重启策略** | ❌ | ✅ `restart` | 运行时策略 |

### 💡 决策口诀

```
构建时固定的 → Dockerfile
运行时可变的 → docker-compose
```

**具体判断**：
- **问自己**："这个配置在开发环境和生产环境会不会不同？"
  - 是 ➜ `docker-compose.yml`
  - 否 ➜ `Dockerfile`

**示例**：
- 端口映射：开发用 3000，生产用 80 ➜ `docker-compose.yml`
- 安装依赖：所有环境都一样 ➜ `Dockerfile`
- 数据库地址：开发用 localhost，生产用真实 IP ➜ `docker-compose.yml`

---

## 🎓 六、常见问题解答（FAQ）

### Q1: 单服务项目要不要用 docker-compose？

**答**：建议使用，即使只有一个服务。

理由：
1. ✅ 配置更清晰，不需要记忆长命令
2. ✅ 团队成员可以一键启动：`docker-compose up -d`
3. ✅ 未来添加数据库、Redis 等服务时无需改变工作流
4. ✅ 便于版本控制（`docker-compose.yml` 一起提交）

**例外情况**：
- ❌ 仅用于临时测试镜像
- ❌ 需要快速分享 Dockerfile 给他人

---

### Q2: 什么时候必须用 docker-compose？

**必须使用的场景**：
1. **多服务项目**：前后端分离、微服务架构
2. **依赖外部服务**：应用 + 数据库 + Redis
3. **复杂网络配置**：多个服务需要相互通信
4. **团队协作**：需要统一开发环境

**可以不用的场景**：
- 单服务 + 无依赖 + 临时测试

---

### Q3: 为什么要把 Dockerfile 和 docker-compose 分开？

**答**：职责分离原则。

- **Dockerfile** = "标准产品"（镜像）
  - 不包含环境特定配置
  - 可以在任何环境运行
  - 可以推送到镜像仓库供他人使用

- **docker-compose** = "使用说明书"
  - 针对特定环境调整配置
  - 开发环境和生产环境可以有不同的 `docker-compose.yml`

**类比**：
- Dockerfile = iPhone 手机（产品本身）
- docker-compose = 个人设置（壁纸、铃声、语言）

---

### Q4: docker-compose 中的 build 和 image 有什么区别？

```yaml
services:
  backend:
    # 方式 1：使用 Dockerfile 构建
    build: ./backend

    # 方式 2：使用已有镜像
    image: my-api:latest

    # 方式 3：两者同时使用
    build: ./backend
    image: my-api:latest  # 构建后打上这个标签
```

**区别**：
- `build`：告诉 Docker 从 Dockerfile 构建镜像
- `image`：指定镜像名称（可以是远程镜像或本地镜像）
- 同时使用：先构建，再打标签

---

### Q5: 开发环境和生产环境如何使用不同配置？

**答**：使用多个 compose 文件。

```bash
# 项目结构
├── docker-compose.yml          # 基础配置
├── docker-compose.dev.yml      # 开发环境覆盖
└── docker-compose.prod.yml     # 生产环境覆盖
```

```yaml
# docker-compose.yml（基础配置）
services:
  backend:
    build: ./backend
    image: my-api:latest
```

```yaml
# docker-compose.dev.yml（开发环境覆盖）
services:
  backend:
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
    volumes:
      - ./backend:/app  # 挂载源代码，支持热重载
```

```yaml
# docker-compose.prod.yml（生产环境覆盖）
services:
  backend:
    ports:
      - "80:3000"
    environment:
      NODE_ENV: production
    restart: always
```

**使用方式**：

```bash
# 开发环境
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 生产环境
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

### Q6: 为什么 Dockerfile 里设置了 EXPOSE，还要在 docker-compose 里写 ports？

**答**：`EXPOSE` 和 `ports` 的作用完全不同。

| 指令 | 作用 | 是否映射到宿主机 |
|-----|------|---------------|
| `EXPOSE 3000` | 文档作用，声明容器监听的端口 | ❌ 不会 |
| `ports: "3000:3000"` | 真正映射端口到宿主机 | ✅ 会 |

**例子**：

```dockerfile
# Dockerfile
EXPOSE 3000   # ⚠️ 这只是说明，不会自动映射
```

如果只有 `EXPOSE`，你无法通过 `localhost:3000` 访问容器。

```yaml
# docker-compose.yml
ports:
  - "3000:3000"   # ✅ 这才真正映射端口
```

**小结**：
- `EXPOSE`：告诉开发者"这个容器监听哪个端口"（可以省略）
- `ports`：告诉 Docker "把容器端口映射到宿主机"（必需，如果需要外部访问）

---

### Q7: CMD 和 ENTRYPOINT 在 docker-compose 中如何覆盖?

```dockerfile
# Dockerfile
ENTRYPOINT ["node"]
CMD ["server.js"]
```

```yaml
# docker-compose.yml

# 场景 1：只覆盖 CMD
command: ["debug.js"]          # 最终运行: node debug.js

# 场景 2：覆盖 ENTRYPOINT
entrypoint: ["npm"]
command: ["start"]             # 最终运行: npm start
```

**规则**：
- `command` 覆盖 `CMD`
- `entrypoint` 覆盖 `ENTRYPOINT`

---

## 🎯 七、快速参考：完整配置模板

### 单服务项目模板

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    image: my-app:latest
    container_name: my-app
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

---

### 多服务项目模板

```yaml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "8080:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
    depends_on:
      - postgres

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: password
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
```

---

## 📚 总结

### 核心要点

1. **职责分离**：
   - Dockerfile = 构建镜像（Build Time）
   - docker-compose = 运行容器（Runtime）

2. **单服务项目**：
   - 可以只用 Dockerfile + `docker run`
   - 但推荐使用 `Dockerfile + docker-compose`（便于管理）

3. **多服务项目**：
   - 必须使用 `docker-compose`
   - 每个自定义服务需要自己的 Dockerfile

4. **配置覆盖**：
   - `docker-compose.yml` 可以覆盖 Dockerfile 的配置
   - 优先级：命令行 > compose > Dockerfile

5. **配置位置选择**：
   - 构建时固定的 ➜ Dockerfile
   - 运行时可变的 ➜ docker-compose

---

## 🚀 学习建议

1. **初学者**：先掌握 Dockerfile，理解镜像构建
2. **进阶**：学习 docker-compose，掌握单服务编排
3. **实战**：尝试搭建前后端分离项目，理解多服务协作
4. **优化**：学习多环境配置、网络调优、性能优化

通过本文档，你应该能够清晰地理解 Dockerfile 和 docker-compose 的关系，并在实际项目中做出正确的配置选择！

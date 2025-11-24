# Dockerfile 指令详解

> 那些看起来相似的指令，到底有什么区别？

## 核心问题

- `CMD` 和 `ENTRYPOINT` 都能指定启动命令，用哪个？
- `COPY` 和 `ADD` 都能复制文件，有什么不同？
- `ARG` 和 `ENV` 都是变量，生命周期有何区别？

本文将逐一解答这些困惑。

---

## 1. CMD vs ENTRYPOINT

### 基本概念

| 指令 | 作用 | 能否被覆盖 |
|------|------|-----------|
| `CMD` | 容器启动时的**默认命令** | ✅ 可以被 `docker run` 参数覆盖 |
| `ENTRYPOINT` | 容器启动时的**固定入口** | ❌ 不会被覆盖（除非用 `--entrypoint`） |

### 示例对比

#### 只用 CMD

```dockerfile
FROM node:18-alpine
CMD ["node", "server.js"]
```

```bash
# 正常启动
docker run myapp
# 实际执行: node server.js

# 覆盖 CMD
docker run myapp node --version
# 实际执行: node --version（CMD 被完全替换）
```

#### 只用 ENTRYPOINT

```dockerfile
FROM node:18-alpine
ENTRYPOINT ["node"]
```

```bash
# 正常启动
docker run myapp
# 实际执行: node（没有参数，会报错）

# 追加参数
docker run myapp server.js
# 实际执行: node server.js（参数被追加到 ENTRYPOINT 后）
```

#### 组合使用（推荐模式）

```dockerfile
FROM node:18-alpine
ENTRYPOINT ["node"]
CMD ["server.js"]
```

```bash
# 正常启动
docker run myapp
# 实际执行: node server.js

# 替换默认参数
docker run myapp --version
# 实际执行: node --version（只替换 CMD 部分）
```

### 图解组合逻辑

```
┌─────────────────────────────────────────────────────────┐
│                    最终执行的命令                         │
│                                                         │
│    ENTRYPOINT        +        CMD / docker run 参数      │
│    (固定部分)                  (可变部分)                 │
│                                                         │
│    ["node"]          +        ["server.js"]             │
│         ↓                          ↓                    │
│                    node server.js                       │
└─────────────────────────────────────────────────────────┘
```

### 使用建议

| 场景 | 推荐方式 |
|------|---------|
| 通用应用镜像 | 只用 `CMD`，方便用户覆盖 |
| 特定用途工具 | `ENTRYPOINT` + `CMD` 组合 |
| 需要包装脚本 | `ENTRYPOINT` 指向 shell 脚本 |

---

## 2. COPY vs ADD

### 基本区别

| 指令 | 功能 | 额外能力 |
|------|------|---------|
| `COPY` | 复制本地文件到镜像 | 无，纯粹复制 |
| `ADD` | 复制本地文件到镜像 | ① 自动解压 tar 包 ② 支持 URL 下载 |

### ADD 的"隐藏能力"

```dockerfile
# ADD 会自动解压 tar 包
ADD archive.tar.gz /app/
# 结果: /app/ 目录下是解压后的文件

# ADD 可以从 URL 下载（不推荐）
ADD https://example.com/file.txt /app/
```

### 为什么官方推荐 COPY？

```
┌────────────────────────────────────────────────────────┐
│  ADD 的问题：                                           │
│                                                        │
│  1. 行为不透明 - 看到 ADD 不知道会不会解压              │
│  2. URL 下载不缓存 - 每次构建都重新下载                 │
│  3. 增加意外风险 - 可能不小心解压了不想解压的文件        │
└────────────────────────────────────────────────────────┘
```

### 使用建议

```dockerfile
# ✅ 推荐：用 COPY 复制普通文件
COPY package*.json ./
COPY src/ ./src/

# ✅ 可以：用 ADD 解压本地 tar 包
ADD app.tar.gz /app/

# ❌ 不推荐：用 ADD 下载远程文件
# 改用 RUN curl 或 RUN wget
RUN curl -o /app/file.txt https://example.com/file.txt
```

**记住**：**90% 的情况用 COPY，只有需要自动解压时才用 ADD**

---

## 3. ARG vs ENV

这是最容易混淆的一对指令！

### 生命周期对比

```
┌─────────────────────────────────────────────────────────┐
│                    构建阶段 (docker build)               │
│                                                         │
│   ARG NODE_VERSION=18    ← ARG 在这里生效               │
│         ↓                                               │
│   FROM node:${NODE_VERSION}-alpine                      │
│         ↓                                               │
│   ENV APP_ENV=production  ← ENV 在这里定义              │
│         ↓                                               │
│   RUN echo $NODE_VERSION  ← ARG 可用 ✓                  │
│   RUN echo $APP_ENV       ← ENV 可用 ✓                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                    运行阶段 (docker run)                 │
│                                                         │
│   echo $NODE_VERSION      ← ARG 不可用 ✗ (已消失)       │
│   echo $APP_ENV           ← ENV 可用 ✓ (持久存在)       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 关键区别

| 特性 | ARG | ENV |
|------|-----|-----|
| 构建时可用 | ✅ | ✅ |
| 运行时可用 | ❌ | ✅ |
| 可在 FROM 前使用 | ✅ | ❌ |
| 会写入镜像元数据 | ❌ | ✅ |
| 构建时可覆盖 | `--build-arg` | 不可 |
| 运行时可覆盖 | 不可 | `-e` 或 `--env` |

### 使用示例

```dockerfile
# ARG: 用于构建时的配置
ARG NODE_VERSION=18
FROM node:${NODE_VERSION}-alpine

# ARG 需要在 FROM 后重新声明才能使用
ARG BUILD_DATE
RUN echo "Build date: $BUILD_DATE"

# ENV: 用于运行时的配置
ENV NODE_ENV=production
ENV PORT=3000

# 常见模式：ARG 传递给 ENV
ARG APP_VERSION=1.0.0
ENV APP_VERSION=$APP_VERSION
```

### 构建时传参

```bash
# 覆盖 ARG 的默认值
docker build --build-arg NODE_VERSION=20 --build-arg BUILD_DATE=$(date +%Y%m%d) .
```

### 使用建议

| 场景 | 用 ARG | 用 ENV |
|------|--------|--------|
| 控制基础镜像版本 | ✅ | |
| 构建时的临时变量 | ✅ | |
| 应用运行时配置 | | ✅ |
| 需要容器内访问 | | ✅ |
| 敏感信息（密码） | ❌ 不安全 | ❌ 不安全 |

---

## 4. EXPOSE 的真正作用

### 常见误解

> "EXPOSE 80 就是开放 80 端口"

**错！** `EXPOSE` 只是**文档声明**，不会真正开放端口。

### 实际作用

```dockerfile
# 这只是告诉使用者：这个容器设计用于监听 80 和 443 端口
EXPOSE 80
EXPOSE 443
```

```bash
# 真正开放端口需要 -p 参数
docker run -p 8080:80 myapp
```

### EXPOSE 的价值

| 作用 | 说明 |
|------|------|
| 文档化 | 告诉用户容器使用哪些端口 |
| `docker run -P` | 自动映射所有 EXPOSE 的端口到随机端口 |
| 容器间通信 | 同一网络的容器可直接访问 EXPOSE 的端口 |

---

## 5. WORKDIR vs RUN cd

### ❌ 错误做法

```dockerfile
RUN cd /app
RUN npm install  # 这不会在 /app 目录执行！
```

**原因**：每个 `RUN` 都是独立的 shell，`cd` 的效果不会保留。

### ✅ 正确做法

```dockerfile
WORKDIR /app
RUN npm install  # 在 /app 目录执行 ✓
```

### WORKDIR 的特性

```dockerfile
# WORKDIR 会自动创建目录（如果不存在）
WORKDIR /app/src/components

# 支持相对路径（相对于上一个 WORKDIR）
WORKDIR /app
WORKDIR src      # 等于 /app/src
WORKDIR ../lib   # 等于 /app/lib

# 支持环境变量
ENV APP_HOME=/application
WORKDIR $APP_HOME
```

---

## 6. 其他常用指令速查

### USER - 切换用户

```dockerfile
# 创建非 root 用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 切换用户（后续指令以此用户执行）
USER appuser

# 之后的 RUN、CMD、ENTRYPOINT 都以 appuser 身份运行
```

### HEALTHCHECK - 健康检查

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--interval` | 检查间隔 | 30s |
| `--timeout` | 超时时间 | 30s |
| `--start-period` | 启动等待期 | 0s |
| `--retries` | 失败重试次数 | 3 |

### LABEL - 元数据标签

```dockerfile
LABEL maintainer="dev@example.com"
LABEL version="1.0"
LABEL description="My awesome app"
```

### SHELL - 更改默认 shell

```dockerfile
# 默认是 ["/bin/sh", "-c"]
# 可以改为 bash
SHELL ["/bin/bash", "-c"]

# 之后的 RUN 指令会使用 bash
RUN source ~/.bashrc && echo $PATH
```

---

## 7. 项目实战：解读本项目 Dockerfile

以 `backend/Dockerfile` 为例：

```dockerfile
# ========== 基础阶段 ==========
FROM node:18-alpine AS base          # 多阶段构建，命名为 base
WORKDIR /app                          # 设置工作目录

# ========== 开发阶段 ==========
FROM base AS development              # 继承 base 阶段
COPY package*.json ./                 # 先复制依赖声明（缓存优化）
RUN npm install                       # 安装所有依赖（含 devDependencies）
COPY . .                              # 复制源代码
CMD ["npm", "run", "dev"]             # 开发模式启动命令

# ========== 构建阶段 ==========
FROM base AS builder
COPY package*.json ./
RUN npm ci                            # 干净安装，用于生产构建
COPY . .
RUN npm run build                     # 编译 TypeScript

# ========== 生产阶段 ==========
FROM base AS production
ENV NODE_ENV=production               # 设置运行时环境变量

# 创建非 root 用户（安全加固）
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

# 只复制生产所需文件
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

EXPOSE 5001
HEALTHCHECK CMD curl -f http://localhost:5001/health || exit 1
CMD ["node", "dist/server.js"]        # 生产模式启动命令
```

---

## 8. 指令速查表

| 指令 | 用途 | 示例 |
|------|------|------|
| `FROM` | 指定基础镜像 | `FROM node:18-alpine` |
| `WORKDIR` | 设置工作目录 | `WORKDIR /app` |
| `COPY` | 复制文件 | `COPY . .` |
| `ADD` | 复制+解压+下载 | `ADD app.tar.gz /app/` |
| `RUN` | 执行命令 | `RUN npm install` |
| `ENV` | 设置运行时环境变量 | `ENV NODE_ENV=production` |
| `ARG` | 设置构建时变量 | `ARG VERSION=1.0` |
| `EXPOSE` | 声明端口 | `EXPOSE 3000` |
| `CMD` | 默认启动命令 | `CMD ["node", "app.js"]` |
| `ENTRYPOINT` | 固定入口命令 | `ENTRYPOINT ["node"]` |
| `USER` | 切换用户 | `USER nodejs` |
| `HEALTHCHECK` | 健康检查 | `HEALTHCHECK CMD curl ...` |
| `LABEL` | 添加元数据 | `LABEL version="1.0"` |

---

## 下一步

理解了 Dockerfile 指令后，建议继续阅读：
- [容器生命周期与常用命令.md](./容器生命周期与常用命令.md) - 掌握容器管理命令

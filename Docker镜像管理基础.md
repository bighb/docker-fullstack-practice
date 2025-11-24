# Docker 镜像管理基础

> 本地镜像越来越多，如何有效管理？

## 核心概念

镜像是容器的**只读模板**，包含运行应用所需的一切：代码、运行时、库、环境变量、配置文件等。

---

## 1. 镜像命名规范

### 完整格式

```
[registry/][namespace/]repository[:tag]
```

### 各部分说明

```
docker.io/library/nginx:1.25-alpine
    │        │      │       │
    │        │      │       └── tag（标签/版本）
    │        │      └────────── repository（仓库名）
    │        └───────────────── namespace（命名空间/用户名）
    └────────────────────────── registry（镜像仓库地址）
```

### 实际示例

| 完整名称 | 说明 |
|---------|------|
| `nginx` | 等于 `docker.io/library/nginx:latest` |
| `nginx:alpine` | 官方 Nginx 的 Alpine 版本 |
| `myuser/myapp:v1.0` | 用户 myuser 的 myapp 镜像 |
| `gcr.io/google/node:18` | Google 仓库的 Node 镜像 |
| `192.168.1.100:5000/app:dev` | 私有仓库的镜像 |

### 常用标签约定

| 标签 | 含义 |
|------|------|
| `latest` | 最新版本（默认，不推荐生产用） |
| `1.0`, `v1.0.0` | 语义化版本号 |
| `alpine` | 基于 Alpine Linux（更小） |
| `slim` | 精简版 |
| `bullseye`, `bookworm` | Debian 版本代号 |

---

## 2. 镜像查看命令

### docker images / docker image ls

```bash
# 列出本地所有镜像
docker images

# 等效命令
docker image ls

# 输出示例：
REPOSITORY   TAG       IMAGE ID       CREATED        SIZE
nginx        alpine    a1b2c3d4e5f6   2 weeks ago    23.5MB
node         18        b2c3d4e5f6a7   3 weeks ago    991MB
postgres     15        c3d4e5f6a7b8   1 month ago    379MB
```

### 过滤和格式化

```bash
# 只显示镜像 ID
docker images -q

# 按名称过滤
docker images nginx

# 按条件过滤
docker images --filter "dangling=true"    # 悬空镜像
docker images --filter "before=nginx:1.24" # 在某镜像之前创建的

# 自定义输出格式
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

### docker image inspect

```bash
# 查看镜像详细信息
docker image inspect nginx:alpine

# 查看特定字段
docker image inspect --format='{{.Config.Cmd}}' nginx:alpine
docker image inspect --format='{{.Config.ExposedPorts}}' nginx:alpine
```

---

## 3. 镜像拉取与推送

### docker pull - 拉取镜像

```bash
# 拉取最新版本
docker pull nginx

# 拉取指定标签
docker pull nginx:1.25-alpine

# 拉取指定架构（M1/M2 Mac 可能需要）
docker pull --platform linux/amd64 nginx:alpine

# 拉取所有标签（不常用）
docker pull -a nginx
```

### docker push - 推送镜像

```bash
# 先登录到镜像仓库
docker login

# 推送到 Docker Hub
docker push myuser/myapp:v1.0

# 推送到私有仓库
docker push 192.168.1.100:5000/myapp:v1.0
```

**推送前必须**：镜像名称必须包含仓库地址/用户名前缀

---

## 4. docker tag - 镜像标签管理

### 基本用法

```bash
# 给镜像添加新标签
docker tag SOURCE_IMAGE[:TAG] TARGET_IMAGE[:TAG]

# 示例：给本地镜像添加版本标签
docker tag myapp:latest myapp:v1.0.0

# 添加用户前缀（准备推送到 Docker Hub）
docker tag myapp:v1.0.0 myuser/myapp:v1.0.0

# 添加私有仓库前缀
docker tag myapp:v1.0.0 192.168.1.100:5000/myapp:v1.0.0
```

### 常用场景

```bash
# 场景1: 为发布准备多个标签
docker tag myapp:latest myapp:v1.0.0
docker tag myapp:latest myapp:v1.0
docker tag myapp:latest myapp:v1

# 场景2: 准备推送到不同仓库
docker tag myapp:v1.0.0 docker.io/myuser/myapp:v1.0.0
docker tag myapp:v1.0.0 ghcr.io/myuser/myapp:v1.0.0
```

### 标签与 ID 的关系

```
┌────────────────────────────────────────────────────────┐
│                   镜像 ID: a1b2c3d4e5f6                │
│                   (实际的镜像内容)                      │
├────────────────────────────────────────────────────────┤
│  标签1: myapp:latest     ─┐                            │
│  标签2: myapp:v1.0.0      ├── 都指向同一个镜像 ID       │
│  标签3: myuser/myapp:v1  ─┘                            │
└────────────────────────────────────────────────────────┘
```

**重要**：标签只是别名，多个标签可以指向同一个镜像 ID

---

## 5. 镜像删除与清理

### docker rmi - 删除镜像

```bash
# 删除指定镜像
docker rmi nginx:alpine

# 删除多个镜像
docker rmi nginx:alpine node:18 postgres:15

# 强制删除（即使有容器使用）
docker rmi -f nginx:alpine

# 删除所有未使用的镜像（危险！）
docker rmi $(docker images -q)
```

### 什么是 Dangling 镜像（悬空镜像）？

当你重新构建同名镜像时，旧版本会变成 dangling 状态：

```
第一次构建:
myapp:latest  →  镜像 ID: a1b2c3d4

第二次构建（内容变了）:
myapp:latest  →  镜像 ID: e5f6g7h8  (新的)
<none>:<none> →  镜像 ID: a1b2c3d4  (变成 dangling)
```

```bash
# 查看 dangling 镜像
docker images -f dangling=true

# 删除所有 dangling 镜像
docker image prune
```

### docker system prune - 全面清理

```bash
# 清理所有未使用的资源（容器、网络、镜像缓存）
docker system prune

# 包括未使用的镜像（不仅是 dangling）
docker system prune -a

# 包括数据卷（危险！会删除数据）
docker system prune -a --volumes

# 跳过确认提示
docker system prune -f
```

### 清理命令对比

| 命令 | 清理内容 |
|------|---------|
| `docker container prune` | 已停止的容器 |
| `docker image prune` | dangling 镜像 |
| `docker image prune -a` | 所有未使用的镜像 |
| `docker network prune` | 未使用的网络 |
| `docker volume prune` | 未使用的数据卷 |
| `docker builder prune` | 构建缓存 |
| `docker system prune` | 以上全部（除数据卷） |
| `docker system prune -a --volumes` | 全部包括数据卷 |

---

## 6. docker system df - 查看磁盘使用

```bash
# 查看 Docker 磁盘使用概览
docker system df

# 输出示例：
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          15        5         4.2GB     2.1GB (50%)
Containers      8         3         500MB     200MB (40%)
Local Volumes   10        4         1.5GB     800MB (53%)
Build Cache     50        0         2.0GB     2.0GB (100%)
```

```bash
# 查看详细信息
docker system df -v
```

### 字段说明

| 字段 | 说明 |
|------|------|
| TOTAL | 总数量 |
| ACTIVE | 正在使用的数量 |
| SIZE | 占用磁盘空间 |
| RECLAIMABLE | 可回收的空间 |

---

## 7. .dockerignore 文件详解

### 作用

`.dockerignore` 告诉 Docker 在构建时忽略哪些文件，作用类似 `.gitignore`。

### 为什么需要？

```bash
# 不使用 .dockerignore
COPY . .
# 会复制 node_modules(几百MB)、.git(可能很大)、日志文件等

# 使用 .dockerignore 后
# 只复制必要的文件，构建更快，镜像更小
```

### 常用配置

```dockerignore
# 依赖目录（会在容器中重新安装）
node_modules
.pnpm-store

# 版本控制
.git
.gitignore

# 开发配置
.env.local
.env.development
*.log

# IDE 配置
.idea
.vscode
*.swp

# 测试和文档
coverage
docs
*.md
!README.md

# 构建产物
dist
build
*.tgz

# Docker 相关
Dockerfile*
docker-compose*
.dockerignore
```

### 语法规则

| 规则 | 说明 | 示例 |
|------|------|------|
| `#` | 注释 | `# 忽略日志` |
| `*` | 匹配任意字符 | `*.log` |
| `?` | 匹配单个字符 | `?.log` |
| `**` | 匹配多层目录 | `**/*.log` |
| `!` | 取反（不忽略） | `!README.md` |

---

## 8. 镜像体积优化技巧

### 优化对比

| 技巧 | 优化前 | 优化后 |
|------|-------|-------|
| 使用 Alpine 镜像 | `node:18` (991MB) | `node:18-alpine` (175MB) |
| 多阶段构建 | 1GB+ | 100MB 左右 |
| 清理缓存 | 包含 apt/npm 缓存 | 无缓存 |

### 常用优化方法

```dockerfile
# 1. 使用 Alpine 基础镜像
FROM node:18-alpine

# 2. 合并 RUN 命令，减少层数
RUN apk add --no-cache curl && \
    npm install && \
    npm cache clean --force

# 3. 使用 --no-cache 安装
RUN apk add --no-cache python3 make g++

# 4. 多阶段构建（只保留运行时需要的文件）
FROM node:18-alpine AS builder
RUN npm run build

FROM node:18-alpine AS production
COPY --from=builder /app/dist ./dist
```

### 查看优化效果

```bash
# 查看镜像大小
docker images myapp

# 查看各层大小
docker history myapp:latest

# 分析镜像（需要安装 dive 工具）
dive myapp:latest
```

---

## 9. 项目实践

### 查看当前项目镜像

```bash
# 列出项目相关镜像
docker images | grep docker-fullstack

# 查看镜像层详情
docker history docker-fullstack-practice-backend:latest
```

### 清理无用镜像

```bash
# 1. 查看磁盘使用情况
docker system df

# 2. 清理 dangling 镜像
docker image prune

# 3. 清理构建缓存
docker builder prune

# 4. 查看清理后的空间
docker system df
```

### 重新标记项目镜像

```bash
# 给镜像添加版本标签
docker tag docker-fullstack-practice-backend:latest \
  docker-fullstack-practice-backend:v1.0.0

# 验证标签
docker images docker-fullstack-practice-backend
```

---

## 10. 命令速查表

### 镜像查看

| 命令 | 用途 |
|------|------|
| `docker images` | 列出本地镜像 |
| `docker image ls` | 同上 |
| `docker image inspect` | 查看镜像详情 |
| `docker history` | 查看镜像层历史 |

### 镜像操作

| 命令 | 用途 |
|------|------|
| `docker pull` | 拉取镜像 |
| `docker push` | 推送镜像 |
| `docker tag` | 添加/修改标签 |
| `docker build` | 构建镜像 |
| `docker rmi` | 删除镜像 |

### 清理命令

| 命令 | 用途 |
|------|------|
| `docker image prune` | 清理 dangling 镜像 |
| `docker image prune -a` | 清理未使用镜像 |
| `docker builder prune` | 清理构建缓存 |
| `docker system prune` | 全面清理 |
| `docker system df` | 查看磁盘使用 |

---

## 11. 总结口诀

```
镜像命名有规范，
仓库名加标签连。
latest 虽方便用，
版本号更安全。

dangling 镜像要清理，
prune 命令是利器。
Alpine 镜像体积小，
多阶构建更给力。

dockerignore 别忘记，
加速构建省空间。
磁盘满了别着急，
system df 先诊断。
```

---

## 学习路径回顾

至此，你已经掌握了 Docker 基础知识的核心内容：

1. **镜像层原理** - 理解缓存机制，优化构建速度
2. **Dockerfile 指令** - 正确使用每个指令
3. **容器生命周期** - 管理容器的各种状态
4. **镜像管理** - 标签、清理、优化

接下来可以深入学习：
- Docker Compose 高级用法
- Docker 网络进阶
- 生产环境最佳实践

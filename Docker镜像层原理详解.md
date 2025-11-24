# Docker 镜像层原理详解

> 理解镜像层（Layer）机制，是掌握 Docker 构建优化的关键

## 核心问题

**为什么改了一行代码，`docker build` 却要重新运行 `npm install`，花费好几分钟？**

答案就藏在 Docker 的**镜像层缓存机制**中。

---

## 1. 什么是镜像层？

Docker 镜像不是一个整体文件，而是由**多层只读层叠加**而成。

### 洋葱模型图解

```
┌─────────────────────────────────────┐
│         容器可写层 (Container)        │  ← 运行时产生的变化
├─────────────────────────────────────┤
│     Layer 5: CMD ["node", "app"]    │  ← Dockerfile 每条指令
├─────────────────────────────────────┤
│     Layer 4: COPY . /app            │     = 一个新的层
├─────────────────────────────────────┤
│     Layer 3: RUN npm install        │
├─────────────────────────────────────┤
│     Layer 2: COPY package*.json     │
├─────────────────────────────────────┤
│     Layer 1: WORKDIR /app           │
├─────────────────────────────────────┤
│     Base Layer: node:18-alpine      │  ← 基础镜像（也是多层）
└─────────────────────────────────────┘
```

**关键概念**：
- 每一层都是**只读**的
- 层与层之间是**增量**关系（只存储变化）
- 容器运行时，在最顶层添加一个**可写层**

---

## 2. 层缓存机制

Docker 在构建时会**逐层检查缓存**：

```
构建流程：

Dockerfile 指令 1  →  检查缓存  →  命中 ✓  →  跳过，使用缓存
       ↓
Dockerfile 指令 2  →  检查缓存  →  命中 ✓  →  跳过，使用缓存
       ↓
Dockerfile 指令 3  →  检查缓存  →  未命中 ✗ →  重新执行
       ↓
Dockerfile 指令 4  →  缓存失效  →  必须重新执行（即使内容没变）
       ↓
Dockerfile 指令 5  →  缓存失效  →  必须重新执行
```

### 缓存失效规则

| 指令类型 | 缓存判断依据 |
|---------|-------------|
| `COPY` / `ADD` | 文件内容的 checksum（校验和） |
| `RUN` | 命令字符串是否完全相同 |
| 其他指令 | 指令字符串是否完全相同 |

**关键规则**：**一旦某层缓存失效，后续所有层都必须重建！**

---

## 3. 一个典型的错误示例

### ❌ 低效的 Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 先复制所有文件
COPY . .

# 再安装依赖
RUN npm install

CMD ["node", "server.js"]
```

**问题分析**：

```
你改了 server.js 中的一行代码...

Layer 1: FROM        → 缓存命中 ✓
Layer 2: WORKDIR     → 缓存命中 ✓
Layer 3: COPY . .    → 缓存失效 ✗ （因为 server.js 变了）
Layer 4: npm install → 被迫重新执行 😱（即使 package.json 没变！）
Layer 5: CMD         → 被迫重新执行
```

每次改代码都要等 `npm install`，浪费几分钟！

---

### ✅ 优化后的 Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 先只复制依赖声明文件
COPY package*.json ./

# 安装依赖（这层会被缓存）
RUN npm install

# 最后复制源代码
COPY . .

CMD ["node", "server.js"]
```

**优化分析**：

```
你改了 server.js 中的一行代码...

Layer 1: FROM              → 缓存命中 ✓
Layer 2: WORKDIR           → 缓存命中 ✓
Layer 3: COPY package*.json→ 缓存命中 ✓ （package.json 没变）
Layer 4: npm install       → 缓存命中 ✓ （依赖层被复用！）
Layer 5: COPY . .          → 缓存失效 ✗ （只重建这层）
Layer 6: CMD               → 重新执行（很快）
```

秒级构建完成！

---

## 4. 查看镜像层：docker history

使用 `docker history` 命令可以查看镜像的层结构：

```bash
# 查看镜像层
docker history frontend:latest

# 输出示例：
IMAGE          CREATED       CREATED BY                                      SIZE
a1b2c3d4e5f6   2 hours ago   CMD ["nginx" "-g" "daemon off;"]               0B
<missing>      2 hours ago   COPY /app/build /usr/share/nginx/html          1.2MB
<missing>      2 hours ago   RUN npm run build                               45MB
<missing>      2 hours ago   RUN npm install                                 180MB
<missing>      2 hours ago   COPY package*.json ./                           2KB
<missing>      3 hours ago   WORKDIR /app                                    0B
<missing>      2 weeks ago   /bin/sh -c #(nop)  CMD ["node"]                 0B
...
```

**分析技巧**：
- `SIZE` 列显示每层的大小
- 找到最大的层，考虑是否可以优化
- `<missing>` 表示中间层（正常现象）

---

## 5. 缓存优化的黄金法则

```
┌────────────────────────────────────────────────────────┐
│                 Dockerfile 优化原则                     │
├────────────────────────────────────────────────────────┤
│                                                        │
│    变化频率低的指令  →  放在 Dockerfile 前面             │
│                         ↓                              │
│    变化频率中的指令  →  放在 Dockerfile 中间             │
│                         ↓                              │
│    变化频率高的指令  →  放在 Dockerfile 后面             │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 按变化频率排序的常见指令

| 优先级 | 指令 | 变化频率 | 示例 |
|-------|------|---------|------|
| 1 | `FROM` | 极低 | 基础镜像很少变 |
| 2 | `RUN apt-get install` | 低 | 系统依赖很少变 |
| 3 | `COPY package*.json` | 低 | 依赖声明偶尔变 |
| 4 | `RUN npm install` | 低 | 跟随 package.json |
| 5 | `COPY . .` | **高** | 源代码经常变 |
| 6 | `CMD` / `ENTRYPOINT` | 低 | 启动命令很少变 |

---

## 6. 项目实践：分析当前项目的 Dockerfile

查看本项目 `backend/Dockerfile` 的层结构：

```bash
# 构建后端镜像
docker-compose build backend

# 查看镜像层
docker history docker-fullstack-practice-backend:latest --no-trunc
```

**你会发现**：
1. 我们的 Dockerfile 已经采用了优化顺序
2. `package*.json` 先于源代码复制
3. 多阶段构建进一步减少了最终镜像体积

---

## 7. 常见问题 FAQ

### Q1: 为什么我改了代码，缓存还是没失效？

检查 `.dockerignore` 文件，确认改动的文件没有被忽略。

### Q2: 如何强制不使用缓存？

```bash
# 使用 --no-cache 参数
docker build --no-cache -t myapp .

# 或在 docker-compose 中
docker-compose build --no-cache
```

### Q3: 缓存存在哪里？

Docker 的构建缓存存储在 Docker 的数据目录中：
- macOS/Windows: Docker Desktop 管理
- Linux: `/var/lib/docker/`

### Q4: 如何清理构建缓存？

```bash
# 清理构建缓存
docker builder prune

# 清理所有未使用的资源（包括缓存）
docker system prune -a
```

---

## 8. 总结口诀

```
镜像分层像洋葱，
每条指令加一层。
缓存失效往下传，
顺序优化是关键。

依赖声明放前面，
源码复制放后边。
改了代码秒构建，
不用等待 npm install。
```

---

## 下一步

理解了镜像层原理后，建议继续阅读：
- [Dockerfile指令详解.md](./Dockerfile指令详解.md) - 深入理解每个指令的用法

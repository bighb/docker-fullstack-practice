# Docker 全栈练习项目

## 项目架构

- **前端**: React + Nginx
- **后端**: Node.js (Express)
- **数据库**: PostgreSQL
- **缓存**: Redis
- **反向代理**: Nginx

## 学习目标

1. ✅ 编写 Dockerfile
2. ✅ 使用 docker-compose 编排多容器应用
3. ✅ 容器间网络通信
4. ✅ 数据持久化 (Volumes)
5. ✅ 环境变量管理
6. ✅ 多阶段构建优化镜像
7. ✅ Docker 网络与端口映射

## 快速开始

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 根据需要修改 .env 中的配置（可选）
```

### 2. 启动所有服务（开发模式）

```bash
docker-compose up -d
```

### 3. 查看运行状态

```bash
docker-compose ps
docker-compose logs -f
```

### 4. 访问应用

- 前端: http://localhost:3000
- 后端 API: http://localhost:5001/api/health
- 数据库: localhost:5432

### 5. 停止服务

```bash
docker-compose down
```

### 6. 清理（包括数据卷）

```bash
docker-compose down -v
```

## 开发模式 vs 生产模式

本项目支持两种运行模式，通过不同的 Docker Compose 配置文件实现：

### 开发模式（默认）

```bash
# 使用 docker-compose.yml
docker-compose up -d

# 或使用 Makefile
make up
```

特点：

- 源代码挂载，支持热重载
- 完整的开发依赖
- 详细的日志输出
- 使用 Dockerfile 的 `development` 阶段

### 生产模式

```bash
# 合并基础配置和生产配置
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 或使用 Makefile
make prod-up
```

特点：

- 精简的生产镜像
- 无源码挂载
- 自动重启策略
- 资源限制
- 使用 Dockerfile 的 `production` 阶段

### 配置文件说明

| 文件                      | 用途                         |
| ------------------------- | ---------------------------- |
| `docker-compose.yml`      | 基础配置 / 开发环境          |
| `docker-compose.prod.yml` | 生产环境覆盖配置             |
| `.env.example`            | 环境变量模板                 |
| `.env`                    | 实际环境变量（不提交到 Git） |

## 进阶练习

### 练习 1: 修改后端代码并重新构建

```bash
# 修改 backend/src/index.js
docker-compose up -d --build backend
```

### 练习 2: 进入容器调试

```bash
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres -d myapp
```

### 练习 3: 查看日志

```bash
docker-compose logs backend
docker-compose logs -f --tail=100 backend
```

### 练习 4: 扩展服务

```bash
docker-compose up -d --scale backend=3
```

### 练习 5: 数据备份

```bash
docker-compose exec postgres pg_dump -U postgres myapp > backup.sql
```

## Docker 命令速查

### 镜像管理

```bash
docker images                    # 查看镜像
docker build -t myapp:v1 .      # 构建镜像
docker rmi <image_id>           # 删除镜像
docker image prune              # 清理未使用镜像
```

### 容器管理

```bash
docker ps                       # 查看运行容器
docker ps -a                    # 查看所有容器
docker exec -it <container> sh  # 进入容器
docker logs <container>         # 查看日志
docker stop <container>         # 停止容器
docker rm <container>           # 删除容器
```

### 网络管理

```bash
docker network ls               # 查看网络
docker network inspect <name>   # 查看网络详情
```

### 数据卷管理

```bash
docker volume ls                # 查看数据卷
docker volume inspect <name>    # 查看数据卷详情
docker volume prune             # 清理未使用数据卷
```

## 扩展挑战

1. **添加 MongoDB 服务**
2. **配置 Nginx 反向代理**
3. **添加健康检查 (healthcheck)**
4. **实现热重载开发环境**
5. **添加 Docker Secrets 管理敏感信息**
6. **配置多环境 (dev/staging/prod)**
7. **使用 Docker Swarm 或 Kubernetes**

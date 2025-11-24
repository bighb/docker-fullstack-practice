# 多阶段构建 React 应用
# 使用多阶段构建可以减小最终镜像体积,并分离开发和生产环境

# ============================================
# 开发环境阶段
# ============================================
FROM node:18-alpine AS development
# 设置工作目录
WORKDIR /app
# 先复制 package.json 和 package-lock.json,利用 Docker 缓存机制
COPY package*.json ./
# 安装所有依赖(包括 devDependencies)
RUN npm install
# 复制所有源代码到容器
COPY . .
# 暴露开发服务器端口
EXPOSE 3000
# 启动开发服务器(支持热重载)
CMD ["npm", "start"]

# ============================================
# 构建阶段
# ============================================
FROM node:18-alpine AS builder
# 设置工作目录
WORKDIR /app
# 复制依赖文件
COPY package*.json ./
# 使用 npm ci 进行干净安装,速度更快且更适合 CI/CD
RUN npm ci
# 复制所有源代码
COPY . .
# 执行生产环境构建,生成优化后的静态文件到 build 目录
RUN npm run build

# ============================================
# 生产环境阶段:使用 Nginx 托管静态文件
# ============================================
FROM nginx:alpine AS production
# 从构建阶段复制生成的静态文件到 Nginx 的默认目录
COPY --from=builder /app/build /usr/share/nginx/html
# 复制自定义 Nginx 配置文件(用于配置路由、代理等)
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 暴露 HTTP 端口
EXPOSE 80
# 启动 Nginx 服务(daemon off 表示前台运行)
CMD ["nginx", "-g", "daemon off;"]

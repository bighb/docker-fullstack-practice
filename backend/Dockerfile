# 多阶段构建示例

# 阶段 1: 基础镜像
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# 阶段 2: 开发环境
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5001
CMD ["npm", "run", "dev"]

# 阶段 3: 构建生产版本
FROM base AS builder
RUN npm ci --only=production
COPY . .

# 阶段 4: 生产环境（精简镜像）
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "src/index.js"]

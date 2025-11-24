# Docker 全栈项目 Makefile

.PHONY: help build up down logs restart clean prune ps exec-backend exec-db backup

help: ## 显示帮助信息
	@echo "Docker 全栈练习项目 - 可用命令:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## 构建所有镜像
	docker-compose build

up: ## 启动所有服务
	docker-compose up -d

down: ## 停止所有服务
	docker-compose down

logs: ## 查看所有服务日志
	docker-compose logs -f

restart: ## 重启所有服务
	docker-compose restart

clean: ## 停止并删除所有容器、网络和数据卷
	docker-compose down -v

prune: ## 清理 Docker 系统（谨慎使用）
	docker system prune -af --volumes

ps: ## 查看运行状态
	docker-compose ps

exec-backend: ## 进入后端容器
	docker-compose exec backend sh

exec-db: ## 进入数据库容器
	docker-compose exec postgres psql -U postgres -d myapp

backup: ## 备份数据库
	docker-compose exec postgres pg_dump -U postgres myapp > backup_$(shell date +%Y%m%d_%H%M%S).sql

dev: ## 启动开发环境
	docker-compose up

prod-build: ## 构建生产镜像
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-up: ## 启动生产环境
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

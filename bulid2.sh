docker run --rm -p 9000:9000# 构建主应用镜像（每次都可以构建，速度快）：
# 先左右bulid1.sh
DOCKER_BUILDKIT=0 docker build -f Dockerfile.app -t myapp-app:latest .
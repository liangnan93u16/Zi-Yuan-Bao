#!/bin/bash

# 设置错误时退出
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 镜像名称，可根据需要修改
IMAGE_NAME="geren:latest"

# 显示帮助信息
show_help() {
    echo -e "${BLUE}使用方法:${NC}"
    echo "  $0 [选项]"
    echo ""
    echo -e "${BLUE}选项:${NC}"
    echo "  -h, --help     显示此帮助信息"
    echo "  -c, --clean    构建前清理旧镜像"
    echo "  -p, --push     构建后推送到远程仓库"
    echo "  -t, --tag TAG  指定镜像标签 (默认: latest)"
    echo ""
    echo -e "${BLUE}示例:${NC}"
    echo "  $0                    # 基本构建"
    echo "  $0 -c                 # 清理后构建"
    echo "  $0 -t v1.0.0          # 指定标签构建"
    echo "  $0 -c -t v1.0.0 -p    # 清理、指定标签、推送"
}

# 解析命令行参数
CLEAN=false
PUSH=false
TAG="latest"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}错误: 未知参数 $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 更新镜像名称
IMAGE_NAME="geren:${TAG}"

# 记录开始时间
START_TIME=$(date +%s)

echo -e "${BLUE}=== Docker 镜像构建脚本 ===${NC}"
echo -e "${YELLOW}镜像名称:${NC} $IMAGE_NAME"
echo -e "${YELLOW}构建时间:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 清理旧镜像
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}[1/4] 清理旧镜像...${NC}"
    if docker images | grep -q "geren"; then
        docker rmi $(docker images | grep "geren" | awk '{print $3}') 2>/dev/null || true
        echo -e "${GREEN}✓ 旧镜像清理完成${NC}"
    else
        echo -e "${BLUE}ℹ 没有找到旧镜像需要清理${NC}"
    fi
    echo ""
fi

# 检查 Dockerfile 是否存在
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}错误: 当前目录下没有找到 Dockerfile${NC}"
    exit 1
fi

# 构建镜像
echo -e "${YELLOW}[2/4] 开始构建 Docker 镜像...${NC}"
echo -e "${BLUE}构建命令:${NC} docker build -t $IMAGE_NAME ."
echo ""

if docker build -t $IMAGE_NAME .; then
    echo ""
    echo -e "${GREEN}✓ 镜像构建成功！${NC}"
else
    echo ""
    echo -e "${RED}✗ 镜像构建失败！${NC}"
    exit 1
fi

# 显示镜像信息
echo ""
echo -e "${YELLOW}[3/4] 镜像信息:${NC}"
docker images | grep "geren" | head -1

# 计算构建时间
END_TIME=$(date +%s)
BUILD_TIME=$((END_TIME - START_TIME))
echo ""
echo -e "${GREEN}构建耗时: ${BUILD_TIME} 秒${NC}"

# 推送到远程仓库
if [ "$PUSH" = true ]; then
    echo ""
    echo -e "${YELLOW}[4/4] 推送到远程仓库...${NC}"
    echo -e "${BLUE}注意: 推送前请确保已登录 Docker Hub 或相关仓库${NC}"
    read -p "是否继续推送? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if docker push $IMAGE_NAME; then
            echo -e "${GREEN}✓ 推送成功！${NC}"
        else
            echo -e "${RED}✗ 推送失败！${NC}"
            exit 1
        fi
    else
        echo -e "${BLUE}跳过推送${NC}"
    fi
fi

echo ""
echo -e "${GREEN}=== 构建完成 ===${NC}"
echo -e "${BLUE}本地运行命令:${NC}"
echo "  docker run --rm -p 9000:9000 $IMAGE_NAME"
echo ""
echo -e "${BLUE}其他有用命令:${NC}"
echo "  docker images | grep geren    # 查看镜像"
echo "  docker rmi $IMAGE_NAME                   # 删除镜像"
echo "  docker history $IMAGE_NAME               # 查看镜像历史" 
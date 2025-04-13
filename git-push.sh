#!/bin/bash

# 设置代理
export http_proxy=http://0.0.0.0:10887
export https_proxy=http://0.0.0.0:10887

# 获取当前时间
current_time=$(date "+%Y-%m-%d %H:%M:%S")

# 获取当前分支
current_branch=$(git branch --show-current)

# 添加所有更改
echo "正在添加更改..."
git add .

# 提交更改
echo "正在提交更改..."
git commit -m "更新于 $current_time"

# 推送到远程仓库
echo "正在推送到远程仓库..."
git push origin $current_branch

# 检查推送结果
if [ $? -eq 0 ]; then
    echo "✅ 推送成功！"
else
    echo "❌ 推送失败，请检查网络连接或代理设置。"
    echo "尝试使用官方源推送..."
    unset http_proxy
    unset https_proxy
    git push origin $current_branch
fi 
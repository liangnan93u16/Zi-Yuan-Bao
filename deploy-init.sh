
# 清空 deploy 目录下的所有文件和目录
mkdir -p ../deploy
# 清理旧的 dist 和 node_modules
rm -rf ../deploy/dist
rm -rf ../deploy/node_modules
rm -rf ../deploy/src.map
# 清理可能存在的 public 目录，避免 mv 冲突
rm -rf ../deploy/public

# 本地编译
npm run build
cp -a ./dist ../deploy/dist


# 复制必要的运行文件
cp -a ./theme.json ../deploy/theme.json
cp -a ./serverless.yml ../deploy/serverless.yml
cp -a ./scf_bootstrap ../deploy/scf_bootstrap
cp -a ./package.json ../deploy/package.json
cp -a ./package-lock.json ../deploy/package-lock.json


# 将 dist 下内容移到 deploy 根目录
mv ../deploy/dist/* ../deploy


chmod 755 ../deploy/scf_bootstrap



#  将 node_modules 和 src.map 从云文件中复制过来
# 在云上先用自动化部署获取到 node_modules 和 src.map，然后复制到 云文件 目录下
cp -a ../云文件/node_modules ../deploy/node_modules 
cp -a ../云文件/src.map ../deploy/src.map 
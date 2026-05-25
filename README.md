# 考勤助手

两人考勤打卡工具，支持自动更新

## 🚀 使用流程

### 首次安装

1. **创建 GitHub 仓库并推送**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <你的仓库地址>
   git push -u origin main
   ```

2. **创建版本标签触发构建**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **在 GitHub Releases 下载 APK**
   - 进入仓库 → Releases → 下载 app-debug.apk

4. **安装到手机**
   - 允许安装未知来源
   - 安装 APK

5. **配置更新地址**
   - 编辑 `src/utils/updater.ts`
   - 修改 `GITHUB_REPO` 为你的仓库，例如：`'zhangsan/attendance-app'`
   - 推送更新并创建新标签

---

### 后续更新

1. **修改代码**

2. **创建版本标签**
   ```bash
   git add .
   git commit -m "更新内容"
   git tag v1.0.1
   git push && git push origin v1.0.1
   ```

3. **自动完成**：
   - 构建 APK
   - 构建 dist.zip
   - 发布到 Releases
   - 用户打开应用自动更新

---

## 📱 更新机制

- **首次安装**：用户手动安装 APK
- **后续更新**：应用自动检测新版本，静默下载
- **生效时机**：应用下次打开时自动应用更新

---

## ⚠️ 重要提醒

1. **首次必须手动安装 APK**
2. **推送前配置 GITHUB_REPO**
3. **版本号格式**：`v1.0.0`、`v1.0.1`、`v2.0.0`
4. **热更新限制**：只能更新 JS/CSS/HTML，不能修改原生代码
5. **只在版本标签时构建**：普通推送不会触发构建

---

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 同步到 Android
npx cap sync
```

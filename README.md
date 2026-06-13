# 全球电台（GlobalRadio）

这是一个基于 Vue 3 + Vite 的在线电台应用，包含播放、搜索、收藏、历史记录、主题切换与多国语言等功能，并支持 PWA 安装。

本仓库在 [moli-xia/global-radio](https://github.com/moli-xia/global-radio) 基础上 fork，并增加了**多用户登录**、**服务端数据同步**、**HLS 流代理**、以及 **Android / iOS / Windows 客户端壳** 等能力。

支持 Docker 一键部署（推荐）与本地开发运行。

## 功能概览

- 电台搜索（支持中文）
- 分享电台
- 播放控制
- 睡眠定时器
- 收藏与播放历史
- 亮色/暗色主题
- 全球 14 种语言支持
- 多用户登录，收藏/历史/设置云端同步
- BBC 等 HLS 电台 HTTPS 站点播放（stream-proxy）
- Android / iPhone / Windows 客户端（远程壳模式）

## Fork 新增能力

| 能力 | 说明 |
|------|------|
| 多用户认证 | 登录后通过 HttpOnly Cookie 维持会话 |
| 用户数据同步 | 收藏、历史、语言、主题按账号保存到服务端 |
| Stream Proxy | 解决 HTTPS 页面播放 HLS 的 CORS 问题 |
| 客户端壳 | 启动时输入后台 URL，连接远程站点后走网页同款登录 |
| 多语言文案 | 登录/账号/Shell/原生菜单均支持 14 种语言 |

## 演示站点

### https://aabb.live

### 现已加入 https://kejilion.sh 科技lion的脚本，实现一键安装并配置域名和 SSL 证书功能。

## 应用截图

![](demo-w.png)
![](demo-b.png)
![](demo-phone.png)

## 目录结构

```text
.
├── src/                    # 前端源码（Vue 应用）
├── shell/                  # 客户端壳页面（输入后台 URL）
├── stream-proxy/           # 后端：流代理 + 认证 + 用户数据 API
├── config/                 # 部署配置示例（users.example.json）
├── android/                # Android Capacitor 工程
├── ios/                    # iOS Capacitor 工程
├── desktop/                # Windows Electron 桌面壳
├── dist/                   # Web 构建产物（npm run build）
├── nginx-static.conf       # 静态站点 Nginx 示例配置
├── nginx.docker.conf       # Docker 镜像内 Nginx 配置
├── Dockerfile              # Docker 构建文件
├── android-build.sh        # Android 工程同步脚本
├── ios-build.sh            # iOS 工程同步脚本
├── desktop-build.sh        # Windows 桌面壳准备脚本
└── package.json
```

## 获取源码

```bash
git clone git@github.com:akang943578/global-radio.git
cd global-radio
```

## 环境要求

- Node.js 18+（推荐 18 LTS）
- npm 9+（建议使用 `npm ci`）
- Docker 20+（Docker 部署需要）
- Android Studio + Android SDK（打 Android APK）
- macOS + Xcode（打 iOS 包）
- Windows 或带 Wine 的 Linux（打 Windows 安装包）

## 快速开始（Web 开发）

```bash
npm ci
npm run dev -- --host 0.0.0.0 --port 4173
```

浏览器访问：

- http://localhost:4173/

## Web 构建与预览

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

## Docker 部署（推荐）

镜像内包含：

- Nginx：托管 `dist/` 静态前端
- `stream-proxy`：HLS 代理、`/api/auth/*`、`/api/user/data`

### 构建镜像

```bash
docker build -t global-radio:latest .
```

### 运行容器

```bash
docker run -d \
  --name global-radio \
  --restart unless-stopped \
  -p 8080:80 \
  -v ./data/users:/app/stream-proxy/data/users \
  -v ./config/users.json:/app/stream-proxy/config/users.json:ro \
  global-radio:latest
```

### 用户账号配置

1. 复制示例配置：

```bash
mkdir -p config data/users
cp config/users.example.json config/users.json
```

2. 编辑 `config/users.json`，按 `{ "username": "...", "password": "..." }` 格式添加账号。

3. 修改后**无需重启容器**，下次登录时会重新读取。

> 注意：请勿将真实 `config/users.json` 提交到 Git。仓库仅保留 `config/users.example.json` 示例。

### 数据持久化

| 挂载路径 | 作用 |
|----------|------|
| `./data/users` | 各用户的收藏/历史/设置 JSON |
| `./config/users.json` | 多用户账号密码（明文，部署侧自行保管） |

### 反向代理

生产环境建议在 NPM / Nginx / Caddy 前加 HTTPS，反代到容器 `8080` 端口即可。前端 API 与 stream-proxy 均走同域 `/api/`、`/stream-proxy/`。

## 多用户登录与数据同步

1. 打开站点后会进入登录页。
2. 登录成功后，收藏、播放历史、语言、主题会同步到服务端。
3. 在「设置 → 账号」可修改密码、退出登录。
4. 切换账号时会清空本地缓存并从服务端拉取对应用户数据。

相关 API：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `GET/PUT /api/user/data`

## 客户端（Android / iOS / Windows）

三个客户端都采用**远程壳**模式：

1. 启动后先显示 `shell/` 连接页，输入后台 URL（如 `https://global-radio.example.com`）
2. 连接成功后跳转到远程 Web 应用
3. 在远程站点完成登录、收听、收藏同步
4. 需要换服务器时，通过原生菜单「服务器设置」回到壳页

| 平台 | 换服务器入口 | 构建命令 |
|------|--------------|----------|
| Android | 右上角「服务器设置」 | `npm run android:build` → `./android-build.sh` → Android Studio 或 `npm run apk:release` |
| iOS | 顶部「服务器设置」 | `npm run ios:build` → `./ios-build.sh` → macOS 上 `pod install` + Xcode |
| Windows | 菜单「应用 → 服务器设置」 | `npm run desktop:dev` 本地调试；Windows 上 `npm run desktop:pack:win` 打包 |

### Android APK

```bash
npm run android:build
./android-build.sh
cd android && ./gradlew assembleRelease
```

APK 输出：`android/app/build/outputs/apk/release/`

### iOS

```bash
npm run ios:build
./ios-build.sh
cd ios/App && pod install
npx cap open ios
```

> iOS 必须在 macOS 上用 Xcode 编译。

### Windows 桌面

```bash
./desktop-build.sh
npm run desktop:dev
```

在 Windows 环境打包：

```bash
npm run desktop:pack:win
```

输出目录：`dist-desktop/`

## 多语言

Web 端支持 14 种语言：中文、English、Español、Français、Deutsch、日本語、한국어、Русский、العربية、Português、Italiano、हिन्दी、ไทย、Tiếng Việt。

- Web：设置页或顶栏语言切换，键名保存在用户云端数据中
- Shell：连接页自带语言选择器
- Android / iOS 原生菜单：跟随系统语言（Android 已提供 14 套 `values-*` 文案）

## 生产部署（静态站点，无 Docker）

若不需要登录同步与 stream-proxy，可仅部署 `dist/`：

```bash
npm run build
```

参考 `nginx-static.conf` 配置 Nginx，注意 SPA 路由回退到 `index.html`。

## 环境变量

如需环境变量，按 `.env.example` 创建 `.env`。不需要时可不创建。

## 运维建议

- 生产环境建议使用 Docker 或 Nginx 托管，前端不需要长期运行 Vite 服务。
- 首页“音乐电台/最新电台”列表有内存缓存（默认 5 分钟），刷新按钮会绕过缓存重新拉取数据。
- 修改 `users.json` 后无需重启容器；用户数据文件位于挂载卷 `data/users/`。

## 常见问题

### 无法访问

1. 确认 `dist/` 已构建且存在 `index.html`
2. Docker 部署时确认端口映射与反向代理配置正确
3. 防火墙 / 安全组放行对应端口

### BBC 等 HLS 无法播放

确认站点走 HTTPS，且容器内 `stream-proxy` 正常运行；前端会通过 `/stream-proxy/` 拉流。

### 收藏丢失

请确认已登录账号；未登录时数据仅保存在浏览器本地。登录后会与服务端同步。

### Android 构建提示 SDK not found

设置 `ANDROID_HOME` 或在 `android/local.properties` 中指定：

```properties
sdk.dir=/path/to/Android/Sdk
```

## 上游项目

- 原仓库：<https://github.com/moli-xia/global-radio>
- 本 Fork：<https://github.com/akang943578/global-radio>

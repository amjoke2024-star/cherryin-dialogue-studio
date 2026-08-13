# Windows x64 便携包设计

## 目标

将当前最新的 CherryIN 画室制作成 Windows 10/11 x64 便携 ZIP。用户解压后双击 `Start-Studio.bat`，即可启动本地服务并在默认浏览器打开画室，无须另行安装 Node.js 或开发工具。

## 包含内容

- 当前生产构建，包含任务刷新恢复、最多四张并发生成和逐张返回。
- Windows x64 Node.js 运行时。
- Next.js 生产运行所需文件和依赖。
- Windows x64 Sharp/libvips 原生组件。
- 可见、可诊断的 `Start-Studio.bat`。
- 简短中文使用说明。

## 数据与隐私

交付包不得包含：

- CherryIN、Apilio 或 BFL API Key。
- 浏览器本地设置或缓存。
- `data/history.json` 中的现有历史记录。
- `public/generated` 中的历史生成图片。
- 当前 Mac 的运行日志、PID、启动代理或应用程序包装。

包内创建空的 `data/history.json` 和空的 `public/generated` 目录，使首次运行直接可写。

## 目录与启动方式

ZIP 根目录使用全英文名称 `CherryIN-Studio-Windows-x64`。启动脚本使用 CRLF 行尾并完成以下操作：

1. 切换到脚本所在目录，支持用户解压到任意英文或中文父目录。
2. 检查 `runtime/node.exe` 是否存在。
3. 启动 Next.js 服务并保留控制台窗口，使错误可见。
4. 等待 `http://localhost:3100/` 可访问。
5. 自动打开默认浏览器。
6. 如果端口已被当前画室占用，直接打开页面；如果被其他程序占用，显示可诊断提示。

窗口关闭时，当前本地服务随之停止。启动失败不得静默退出。

## 构建方式

在当前 Mac 上先运行测试、类型检查和生产构建。随后在独立临时目录安装 Windows x64 生产依赖并准备 Windows Node.js 运行时，不直接复制 Mac 的原生依赖。

最终包必须检查：

- `sharp-win32-x64.node`、libvips DLL 为 PE32+ x86-64。
- 不包含 Mach-O、`.dylib`、Darwin Sharp 或 macOS Node 二进制。
- 启动脚本为 CRLF。
- 历史文件为空，生成图片数量为零。
- 不包含 `.env`、日志或疑似密钥文件。
- ZIP 能完整解压，且生成 SHA-256 校验值。

## 验收边界

Mac 上可以完成源代码测试、生产构建、包结构、Windows 二进制格式、ZIP 完整性和数据清理验证。这些检查不能替代真实 Windows 启动。

最终可用性需要在 Windows 10/11 x64 实机上：

1. 解压 ZIP。
2. 双击 `Start-Studio.bat`。
3. 确认浏览器打开 3100 页面。
4. 填入用户自己的 API Key。
5. 进行一次正常生成测试。

在完成实机测试前，交付状态标注为“Windows 静态校验通过，实机启动待确认”。

## 不在本次范围内

- 制作 MSI/EXE 安装程序。
- 代码签名或绕过 Windows Defender/SmartScreen。
- 打包用户 API Key、历史或图片。
- Windows ARM64、32 位 Windows 或 Windows 7 支持。

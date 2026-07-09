@echo off
chcp 65001 >nul
echo ====================================
echo   我的地图 - 安装脚本
echo ====================================
echo.

:: 检查Node.js
echo [1/4] 检查Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js版本: %NODE_VERSION%

:: 检查npm
echo.
echo [2/4] 检查npm...
npm -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到npm
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [OK] npm版本: %NPM_VERSION%

:: 安装主进程依赖
echo.
echo [3/4] 安装主进程依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 安装主进程依赖失败
    pause
    exit /b 1
)
echo [OK] 主进程依赖安装完成

:: 安装React应用依赖
echo.
echo [4/4] 安装React应用依赖...
cd react-app
call npm install
if %errorlevel% neq 0 (
    echo [错误] 安装React应用依赖失败
    pause
    exit /b 1
)
cd ..
echo [OK] React应用依赖安装完成

echo.
echo ====================================
echo   安装完成！
echo ====================================
echo.
echo 启动命令: npm start
echo.
pause
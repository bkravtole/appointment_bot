@echo off
REM Setup Helper Script for WhatsApp Appointment Bot (Windows)

echo.
echo WhatsApp Appointment Bot - Setup Helper (Windows)
echo ===================================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed. Please install Node.js v14+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo OK Node.js %NODE_VERSION% is installed

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo Error: npm is not installed.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo OK npm %NPM_VERSION% is installed

REM Create .env if it doesn't exist
echo.
if not exist .env (
    echo Creating .env file...
    copy .env.example .env
    echo OK .env file created. Please edit with your credentials.
) else (
    echo OK .env file already exists
)

REM Install dependencies
echo.
echo Installing dependencies...
call npm install

echo.
echo OK Setup complete!
echo.
echo Next steps:
echo 1. Edit .env file with your credentials:
echo    - Google Calendar credentials
echo    - 11za API credentials (optional)
echo    - Supabase credentials (optional)
echo.
echo 2. Run the server:
echo    npm run dev
echo.
echo 3. Test the health endpoint:
echo    curl http://localhost:3000/health
echo.
echo For detailed setup instructions, see QUICKSTART.md
echo.
pause

@echo off
echo Setting up Barangay Attendance System Database...
echo.

REM Check if MySQL is installed
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo MySQL is not installed or not in PATH.
    echo Please install MySQL and add it to your PATH, then run this script again.
    echo.
    echo You can download MySQL from: https://dev.mysql.com/downloads/mysql/
    pause
    exit /b 1
)

echo MySQL found. Creating database...
echo.

REM Create database and tables
mysql -u root -p < database.sql

if %errorlevel% equ 0 (
    echo.
    echo Database setup completed successfully!
    echo Default admin credentials:
    echo Username: admin
    echo Email: admin@barangay.com
    echo Password: password
    echo.
) else (
    echo.
    echo Database setup failed. Please check your MySQL credentials and try again.
)

pause
@echo off
echo Barangay Attendance System Database Setup for XAMPP
echo ===================================================
echo.
echo This script will help you set up the MySQL database for the Barangay System.
echo.
echo Prerequisites:
echo 1. XAMPP installed and running
echo 2. MySQL service started in XAMPP Control Panel
echo 3. phpMyAdmin accessible (usually at http://localhost/phpmyadmin)
echo.
echo Instructions:
echo 1. Open phpMyAdmin in your browser (http://localhost/phpmyadmin)
echo 2. Login with default credentials (username: root, password: [leave blank])
echo 3. Click on "New" in the left sidebar to create a new database
echo 4. Enter "barangay_system" as the database name
echo 5. Click "Create"
echo 6. Click on the "barangay_system" database in the left sidebar
echo 7. Click on "Import" tab at the top
echo 8. Click "Choose File" and select the "database.sql" file from this folder
echo 9. Click "Go" to import the database schema
echo.
echo Alternative: If you have MySQL in your PATH, you can run:
echo mysql -u root -p ^< database.sql
echo (leave password blank when prompted)
echo.
echo Default Admin Credentials:
echo Username: admin
echo Email: admin@barangay.com
echo Password: password
echo.
pause
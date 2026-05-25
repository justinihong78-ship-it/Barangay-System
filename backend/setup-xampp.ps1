# Barangay Attendance System Database Setup for XAMPP
Write-Host "Barangay Attendance System Database Setup for XAMPP" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will help you set up the MySQL database for the Barangay System." -ForegroundColor Yellow
Write-Host ""
Write-Host "Prerequisites:" -ForegroundColor Green
Write-Host "1. XAMPP installed and running" -ForegroundColor White
Write-Host "2. MySQL service started in XAMPP Control Panel" -ForegroundColor White
Write-Host "3. phpMyAdmin accessible (usually at http://localhost/phpmyadmin)" -ForegroundColor White
Write-Host ""
Write-Host "Setup Options:" -ForegroundColor Green
Write-Host "1. Manual setup via phpMyAdmin (recommended for beginners)" -ForegroundColor White
Write-Host "2. Command line setup (requires MySQL in PATH)" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Choose setup method (1 or 2)"

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "Manual Setup Instructions:" -ForegroundColor Green
    Write-Host "==========================" -ForegroundColor Green
    Write-Host ""
    Write-Host "1. Open your web browser and go to: http://localhost/phpmyadmin" -ForegroundColor White
    Write-Host "2. Login with default XAMPP credentials:" -ForegroundColor White
    Write-Host "   - Username: root" -ForegroundColor Cyan
    Write-Host "   - Password: [leave blank]" -ForegroundColor Cyan
    Write-Host "3. Click on 'New' in the left sidebar to create a new database" -ForegroundColor White
    Write-Host "4. Enter 'barangay_system' as the database name" -ForegroundColor White
    Write-Host "5. Click 'Create'" -ForegroundColor White
    Write-Host "6. Click on the 'barangay_system' database in the left sidebar" -ForegroundColor White
    Write-Host "7. Click on 'Import' tab at the top" -ForegroundColor White
    Write-Host "8. Click 'Choose File' and select the 'database.sql' file from this folder" -ForegroundColor White
    Write-Host "9. Click 'Go' to import the database schema" -ForegroundColor White
    Write-Host ""
    Write-Host "After setup, your database will be ready!" -ForegroundColor Green
} elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "Command Line Setup:" -ForegroundColor Green
    Write-Host "===================" -ForegroundColor Green
    Write-Host ""

    # Check if MySQL is available
    try {
        $mysqlCheck = mysql --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "MySQL found. Creating database..." -ForegroundColor Yellow
            Write-Host ""

            # Create database and import schema
            Get-Content "database.sql" | mysql -u root -p

            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "Database setup completed successfully!" -ForegroundColor Green
            } else {
                Write-Host ""
                Write-Host "Database setup failed. Please check your MySQL credentials." -ForegroundColor Red
            }
        } else {
            throw "MySQL not found"
        }
    } catch {
        Write-Host "MySQL is not installed or not in PATH." -ForegroundColor Red
        Write-Host "Please ensure XAMPP's MySQL is running and added to PATH, or use the manual method." -ForegroundColor Red
    }
} else {
    Write-Host "Invalid choice. Please run the script again and choose 1 or 2." -ForegroundColor Red
}

Write-Host ""
Write-Host "Default Admin Credentials:" -ForegroundColor Cyan
Write-Host "Username: admin" -ForegroundColor White
Write-Host "Email: admin@barangay.com" -ForegroundColor White
Write-Host "Password: password" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "1. Start your backend server: npm start" -ForegroundColor White
Write-Host "2. Start your frontend: ng serve --port 4200" -ForegroundColor White
Write-Host "3. Access the application at http://localhost:4200" -ForegroundColor White

Read-Host "Press Enter to exit"
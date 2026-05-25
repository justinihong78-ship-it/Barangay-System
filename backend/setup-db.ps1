# Barangay Attendance System Database Setup Script
Write-Host "Setting up Barangay Attendance System Database..." -ForegroundColor Green
Write-Host ""

# Check if MySQL is installed
try {
    $mysqlVersion = mysql --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "MySQL found. Creating database..." -ForegroundColor Yellow
        Write-Host ""
    } else {
        throw "MySQL not found"
    }
} catch {
    Write-Host "MySQL is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install MySQL and add it to your PATH, then run this script again." -ForegroundColor Red
    Write-Host ""
    Write-Host "You can download MySQL from: https://dev.mysql.com/downloads/mysql/" -ForegroundColor Cyan
    Read-Host "Press Enter to exit"
    exit 1
}

# Create database and tables
try {
    Get-Content "database.sql" | mysql -u root -p
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Database setup completed successfully!" -ForegroundColor Green
        Write-Host "Default admin credentials:" -ForegroundColor Cyan
        Write-Host "Username: admin" -ForegroundColor White
        Write-Host "Email: admin@barangay.com" -ForegroundColor White
        Write-Host "Password: password" -ForegroundColor White
        Write-Host ""
    } else {
        throw "Database creation failed"
    }
} catch {
    Write-Host ""
    Write-Host "Database setup failed. Please check your MySQL credentials and try again." -ForegroundColor Red
}

Read-Host "Press Enter to exit"
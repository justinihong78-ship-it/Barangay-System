# Barangay System Data Restore Script
Write-Host "Restoring Barangay System Default Data..." -ForegroundColor Green
Write-Host ""

# Check if MySQL is available via XAMPP
try {
    $mysqlPath = "C:\xampp\mysql\bin\mysql.exe"
    if (Test-Path $mysqlPath) {
        Write-Host "Using XAMPP MySQL..." -ForegroundColor Yellow
        $mysqlCmd = "& '$mysqlPath' -u root barangay_system"
    } else {
        Write-Host "Using system MySQL..." -ForegroundColor Yellow
        $mysqlCmd = "mysql -u root -p barangay_system"
    }
} catch {
    Write-Host "MySQL not found. Please ensure XAMPP is installed and MySQL is running." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Restore default data
try {
    Write-Host "Ensuring default admin account exists..." -ForegroundColor Cyan
    Invoke-Expression "$mysqlCmd -e `"INSERT IGNORE INTO admins (username, email, password, full_name) VALUES ('admin', 'admin@barangay.com', '\`$2b`$10`$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator');`""

    Write-Host "Ensuring sample resident accounts exist..." -ForegroundColor Cyan
    Invoke-Expression "$mysqlCmd -e `"INSERT IGNORE INTO residents (full_name, email, password, phone, gender, address, barangay, category, date_of_birth, rfid_card_number, status) VALUES ('Juan Dela Cruz', 'juan.delacruz@example.com', '\`$2b`$10`$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 912 345 6789', 'Male', '123 Main Street, Barangay 1', 'Barangay 1', 'Regular Resident', '1990-01-15', 'CARD-29674-15719', 'active');`""
    Invoke-Expression "$mysqlCmd -e `"INSERT IGNORE INTO residents (full_name, email, password, phone, gender, address, barangay, category, date_of_birth, rfid_card_number, status) VALUES ('Maria Santos', 'maria.santos@example.com', '\`$2b`$10`$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 917 555 1234', 'Female', '456 Oak Avenue, Barangay 2', 'Barangay 2', 'Senior Citizen', '1955-03-20', 'CARD-12345-67890', 'active');`""
    Invoke-Expression "$mysqlCmd -e `"INSERT IGNORE INTO residents (full_name, email, password, phone, gender, address, barangay, category, date_of_birth, rfid_card_number, status) VALUES ('Pedro Reyes', 'pedro.reyes@example.com', '\`$2b`$10`$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 918 777 4321', 'Male', '789 Pine Road, Barangay 3', 'Barangay 3', 'PWD', '1985-07-10', 'CARD-54321-09876', 'active');`""

    Write-Host ""
    Write-Host "Data restoration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Default Admin Credentials:" -ForegroundColor Cyan
    Write-Host "Username: admin" -ForegroundColor White
    Write-Host "Password: password" -ForegroundColor White
    Write-Host ""
    Write-Host "Sample Resident Credentials:" -ForegroundColor Cyan
    Write-Host "All sample residents use password: password" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "Data restoration failed. Please check your MySQL connection." -ForegroundColor Red
}

Read-Host "Press Enter to exit"
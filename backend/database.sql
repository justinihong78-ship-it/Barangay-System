-- Barangay Attendance Management System Database Schema

CREATE DATABASE IF NOT EXISTS barangay_system;
USE barangay_system;

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    barangay VARCHAR(100),
    date_of_birth DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Officials table
CREATE TABLE IF NOT EXISTS officials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    avatar VARCHAR(5),
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    term VARCHAR(100) NOT NULL,
    contact VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO officials (avatar, name, position, term, contact, email, status) VALUES
('C', 'Cedric Gem Barimbao', 'Chairman', 'May 01, 2026 - Apr 30, 2030', '+63 912 345 6789', 'cedric.barimbao@barangay.ph', 'Active'),
('J', 'Justeen Limpag', 'Kagawad', 'May 01, 2026 - Apr 30, 2030', '+63 917 555 1234', 'justeen.limpag@barangay.ph', 'Active'),
('V', 'Vince Bryan Caasalan', 'Kagawad', 'May 01, 2026 - Apr 30, 2030', '+63 918 777 4321', 'vince.caasalan@barangay.ph', 'Active'),
('J', 'Justin Ihong', 'Kagawad', 'May 01, 2026 - Apr 30, 2030', '+63 919 888 5678', 'justin.ihong@barangay.ph', 'Active');

-- Residents table
CREATE TABLE IF NOT EXISTS residents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    address TEXT NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    position VARCHAR(100),
    civil_status VARCHAR(50),
    date_of_birth DATE NOT NULL,
    rfid_card_number VARCHAR(50) UNIQUE,
    qr_code_path VARCHAR(255),
    status ENUM('active', 'pending', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Employee Schedule table
-- employee_schedules table removed (out of scope)

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resident_id INT NOT NULL,
    rfid_card_number VARCHAR(50),
    qr_code_data TEXT,
    scan_type ENUM('IN', 'OUT') NOT NULL,
    scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_in TIMESTAMP NULL,
    time_out TIMESTAMP NULL,
    work_hours DECIMAL(5,2),
    attendance_status VARCHAR(20),
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    notes TEXT,
    FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE,
    INDEX idx_scan_time (scan_time),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_rfid (rfid_card_number),
    INDEX idx_resident_id (resident_id)
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    resident_name VARCHAR(100) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    details TEXT NOT NULL,
    status ENUM('Pending', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    notes TEXT,
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at)
);

-- Reports table (for storing generated reports)
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL,
    report_data JSON,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by VARCHAR(100)
);

-- Insert default admin (with IGNORE to prevent duplicates)
INSERT IGNORE INTO admins (username, email, password, full_name) VALUES
('admin', 'admin@barangay.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator');

-- Insert sample residents (with IGNORE to prevent duplicates)
INSERT IGNORE INTO residents (full_name, email, password, phone, gender, address, barangay, category, civil_status, date_of_birth, rfid_card_number, status) VALUES
('Juan Dela Cruz', 'juan.delacruz@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 912 345 6789', 'Male', '123 Main Street, Barangay 1', 'Barangay 1', 'Regular Resident', 'Single', '1990-01-15', 'CARD-29674-15719', 'active'),
('Maria Santos', 'maria.santos@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 917 555 1234', 'Female', '456 Oak Avenue, Barangay 2', 'Barangay 2', 'Senior Citizen', 'Widowed', '1955-03-20', 'CARD-12345-67890', 'active'),
('Pedro Reyes', 'pedro.reyes@example.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 918 777 4321', 'Male', '789 Pine Road, Barangay 3', 'Barangay 3', 'PWD', 'Married', '1985-07-10', 'CARD-54321-09876', 'active');
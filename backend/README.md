# Barangay Resident Attendance Management System - Backend

This is the backend API for the Barangay Resident Attendance Management System built with Node.js, Express.js, and MySQL.

## Features

- **Admin Authentication**: JWT-based authentication for admin users
- **Resident Management**: CRUD operations for resident data with automatic QR code generation
- **Attendance Tracking**: Record Time In/Out using RFID cards or QR codes
- **Service Management**: Track barangay services and requests
- **Admin Management**: Manage admin accounts (requires authentication)
- **File Upload**: Store QR code images securely

## Prerequisites

- Node.js (v14 or higher)
- MySQL Server (XAMPP recommended for Windows)
- npm or yarn

## Quick Start (Development Mode)

The server can run in development mode without MySQL for testing API structure:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Check health endpoint:**
   ```bash
   curl http://localhost:3000/api/health
   ```

The server will indicate if the database is connected or not.

## Full Setup with XAMPP (Recommended for Windows)

### 1. Install XAMPP

Download and install XAMPP from: https://www.apachefriends.org/

### 2. Start XAMPP Services

1. Open XAMPP Control Panel
2. Start Apache and MySQL services

### 3. Set up the Database

Run the XAMPP setup script:

**Windows PowerShell:**
```powershell
.\setup-xampp.ps1
```

**Command Prompt:**
```cmd
setup-xampp.bat
```

This will guide you through setting up the database using phpMyAdmin.

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`
2. Update the database settings if needed (default XAMPP settings should work)

### 5. Start the Backend Server

```bash
npm start
```

## Manual Database Setup

If you prefer manual setup:

1. Open phpMyAdmin: http://localhost/phpmyadmin
2. Create database: `barangay_system`
3. Import the `database.sql` file

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Register new admin (requires auth)

### Residents
- `GET /api/residents` - Get all residents
- `POST /api/residents` - Add new resident
- `PUT /api/residents/:id` - Update resident
- `DELETE /api/residents/:id` - Delete resident

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Record attendance
- `GET /api/attendance/stats` - Get attendance statistics

### Services
- `GET /api/services` - Get all services
- `POST /api/services` - Add new service request
- `PUT /api/services/:id` - Update service status
- `DELETE /api/services/:id` - Delete service
- `GET /api/services/stats/summary` - Get service statistics

### Admins (requires authentication)
- `GET /api/admins` - Get all admins
- `POST /api/admins` - Create new admin
- `PUT /api/admins/:id` - Update admin
- `DELETE /api/admins/:id` - Delete admin

## Default Admin Credentials

- **Username:** admin
- **Email:** admin@barangay.com
- **Password:** password

## Development

### Project Structure

```
backend/
├── middleware/
│   ├── auth.js          # JWT authentication middleware
│   └── ...
├── routes/
│   ├── auth.js          # Authentication routes
│   ├── residents.js     # Resident management routes
│   ├── attendance.js    # Attendance tracking routes
│   ├── services.js      # Service management routes
│   └── admins.js        # Admin management routes
├── uploads/             # QR code image storage
├── database.sql         # Database schema
├── server.js           # Main server file
└── package.json
```

### Environment Variables

Create a `.env` file with:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=barangay_system
JWT_SECRET=your_secret_key
```

## License

This project is licensed under the MIT License.
```powershell
.\setup-db.ps1
```

**Windows Command Prompt:**
```cmd
setup-db.bat
```

Or manually:
```bash
mysql -u root -p < database.sql
```

### 3. Configure Environment Variables

Update the `.env` file with your MySQL credentials:
```
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=barangay_system
JWT_SECRET=your_jwt_secret_key_here
```

### 4. Start the Server

```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Default Admin Credentials

After setting up the database, you can login with:
- Username: `admin`
- Email: `admin@barangay.com`
- Password: `password`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Register new admin

### Residents (Public for attendance scanning)
- `GET /api/residents` - Get all residents
- `GET /api/residents/:id` - Get resident by ID
- `POST /api/residents` - Create new resident
- `PUT /api/residents/:id` - Update resident
- `DELETE /api/residents/:id` - Delete resident
- `POST /api/residents/find` - Find resident by RFID or QR code

### Attendance (Public for scanning)
- `GET /api/attendance` - Get all attendance records
- `GET /api/attendance/resident/:id` - Get attendance by resident ID
- `POST /api/attendance` - Record attendance (Time In/Out)
- `GET /api/attendance/summary` - Get attendance summary
- `DELETE /api/attendance/:id` - Delete attendance record

### Admins (Protected - requires authentication)
- `GET /api/admins` - Get all admins
- `GET /api/admins/:id` - Get admin by ID
- `POST /api/admins` - Create new admin
- `PUT /api/admins/:id` - Update admin
- `DELETE /api/admins/:id` - Delete admin
- `PUT /api/admins/:id/password` - Change admin password

### Health Check
- `GET /api/health` - Server health check

## QR Code Generation

When a resident is registered, a QR code is automatically generated containing:
- Resident ID
- RFID Card Number (if provided)
- Timestamp

QR codes are stored in the `uploads/` directory and served via `/uploads/` endpoint.

## Attendance Logic

The system automatically determines Time In vs Time Out based on the last scan for the day:
- First scan of the day: Time In
- Subsequent scans alternate between Time In and Time Out

## Security

- JWT tokens are required for admin operations
- Passwords are hashed using bcrypt
- CORS is enabled for cross-origin requests
- File uploads are restricted to QR code images

## Database Schema

### Tables
- `admins` - Admin user accounts
- `residents` - Resident information
- `attendance` - Attendance records

See `database.sql` for complete schema definition.

## Development

The server runs on port 3000 by default. Use `npm run dev` for development with nodemon auto-restart.

## Integration with Angular Frontend

The backend is designed to work with the Angular frontend. Make sure to update the API base URL in your Angular services to point to `http://localhost:3000/api`.
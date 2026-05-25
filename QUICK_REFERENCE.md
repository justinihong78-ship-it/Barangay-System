# Quick Reference Guide - Barangay Attendance System

## Feature Quick Links

### Employee Features
- **Dashboard**: Navigate to `/employee-dashboard`
  - View profile information
  - Generate and download QR code
  - View attendance history
  - Check work hours summary
  - Download attendance CSV report

### Admin Features
- **Reports**: Navigate to `/reports`
  - View daily/weekly/monthly statistics
  - Generate individual employee reports
  - Download work hours analysis
  - Filter by date range

### Shared Features
- **Attendance**: Navigate to `/attendance`
  - QR code scanning
  - Manual RFID entry
  - Recently deleted records recovery
  - Real-time attendance logging

## API Quick Reference

### QR Code Management
```
POST http://127.0.0.1:3000/api/qrcode/generate/1
POST http://127.0.0.1:3000/api/qrcode/download/1
```

### Work Hours Tracking
```
GET http://127.0.0.1:3000/api/work-hours/calculate/1/2024-01-15
GET http://127.0.0.1:3000/api/work-hours/summary/1?start_date=2024-01-01&end_date=2024-01-31
```

### Attendance Management
```
GET http://127.0.0.1:3000/api/attendance
GET http://127.0.0.1:3000/api/attendance/recently-deleted
POST http://127.0.0.1:3000/api/attendance
DELETE http://127.0.0.1:3000/api/attendance/:id
POST http://127.0.0.1:3000/api/attendance/:id/restore
```

## Work Hours Calculation Rules
- **Standard Day**: 9:00 AM - 5:00 PM (8 hours)
- **Late Threshold**: 15 minutes after 9:00 AM
- **Undertime**: Total hours < 8
- **Overtime**: Total hours > 8
- **Soft Delete Retention**: 30 days (auto-purge every 12 hours)

## File Locations

### Backend
- Work Hours Routes: `/backend/routes/work-hours.js`
- QR Code Routes: `/backend/routes/qrcode.js`
- Main Server: `/backend/server.js`
- Database Config: `/backend/database.sql`

### Frontend
- Employee Dashboard: `/angular-app/src/app/employee-dashboard.component.ts`
- Dashboard Template: `/angular-app/src/app/employee-dashboard.html`
- Reports Component: `/angular-app/src/app/reports.component.ts`
- API Service: `/angular-app/src/app/api.service.ts`
- Routes Config: `/angular-app/src/app/app.routes.ts`

## Running the System

### Start Backend
```powershell
cd backend
npm install  # if needed
npm start    # or: node server.js
```

### Start Frontend (Development)
```powershell
cd angular-app
npm install  # if needed
npm start    # or: ng serve
```

## Troubleshooting

### Backend Issues
1. **Port 3000 already in use**: Kill process or change port in server.js
2. **Database connection failed**: Verify MySQL is running, check .env credentials
3. **QR code generation fails**: Ensure `qrcode` package is installed (`npm install qrcode`)

### Frontend Issues
1. **Port 4200 already in use**: ng serve will auto-select alternate port
2. **API not responding**: Verify backend is running on port 3000
3. **Compilation errors**: Check console output, usually type annotation issues

## Next Steps (Remaining Tasks)

### Task 5: Service Request Management
- Create service request CRUD endpoints
- Build service request form component
- Implement status workflow (pending → approved → completed)
- Add request history and tracking

### Task 6: Attendance Download (PDF/Excel)
- Install PDF library: `npm install jspdf pdfkit`
- Install Excel library: `npm install xlsx`
- Create export methods in dashboard
- Add download buttons for multiple formats

## Development Notes
- All components are standalone (Angular 14.2.0+)
- No separate module files needed
- Import components directly in routes
- Use FormsModule for form inputs
- Use CommonModule for directives (*ngIf, *ngFor, etc.)

---
**Last Updated**: Feature Implementation Complete
**Status**: All core features implemented and tested

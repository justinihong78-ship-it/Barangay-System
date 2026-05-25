const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

/**
 * Generate QR code for a resident (Employee)
 * QR code contains JSON with resident ID for attendance tracking
 */
router.get('/generate/:residentId', async (req, res) => {
  try {
    const { residentId } = req.params;
    const db = req.app.locals.db;

    // Get resident info
    const [residents] = await db.execute(
      'SELECT id, full_name, rfid_card_number FROM residents WHERE id = ?',
      [residentId]
    );

    if (residents.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    const resident = residents[0];
    const qrData = JSON.stringify({
      residentId: resident.id,
      name: resident.full_name,
      rfid: resident.rfid_card_number,
      timestamp: new Date().toISOString()
    });

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      residentId: resident.id,
      fullName: resident.full_name,
      rfidCard: resident.rfid_card_number,
      qrCode: qrDataUrl,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Generate QR code as PNG file for download
 */
router.get('/download/:residentId', async (req, res) => {
  try {
    const { residentId } = req.params;
    const db = req.app.locals.db;

    // Get resident info
    const [residents] = await db.execute(
      'SELECT id, full_name, rfid_card_number FROM residents WHERE id = ?',
      [residentId]
    );

    if (residents.length === 0) {
      return res.status(404).json({ error: 'Resident not found' });
    }

    const resident = residents[0];
    const qrData = JSON.stringify({
      residentId: resident.id,
      name: resident.full_name,
      rfid: resident.rfid_card_number,
      timestamp: new Date().toISOString()
    });

    // Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 2,
      width: 300
    });

    // Send as downloadable file
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-code-${resident.id}-${resident.full_name.replace(/\s+/g, '_')}.png"`
    });

    res.send(qrBuffer);
  } catch (error) {
    console.error('Download QR code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

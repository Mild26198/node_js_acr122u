# NodeJS_ACR122U

**ACR122U MIFARE Reader/Writer Web Server**  
ระบบเว็บเซิร์ฟเวอร์สำหรับอ่าน/เขียนบัตร MIFARE ผ่านเครื่องอ่าน ACR122U ด้วย Node.js

## ฟีเจอร์หลัก

- ตรวจสอบสถานะเครื่องอ่าน (NFC Reader) และบัตร (Card)
- อ่าน UID ของบัตร (ทั้งแบบปกติและ Little Endian)
- อ่านข้อมูลบัตรแบบ Sector/Block (รองรับการระบุ Key A/B)
- เขียนข้อมูลลงบัตร (รองรับการระบุ Sector/Block และ Key)
- Web Interface ใช้งานง่ายผ่านเบราว์เซอร์

## โครงสร้างโปรเจค

- `server.js` : จุดเริ่มต้นของเซิร์ฟเวอร์
- `app.js` : กำหนด Express app, middleware, routes
- `nfc.js` : ฟังก์ชันหลักสำหรับเชื่อมต่อและสื่อสารกับ ACR122U
- `routes/status.js` : REST API สำหรับเช็คสถานะ reader/card, อ่าน UID
- `routes/sector.js` : REST API สำหรับอ่าน/เขียน sector/block ของบัตร
- `public/` : ไฟล์ frontend (HTML, JS, CSS)

## การติดตั้ง

1. ติดตั้ง Node.js (แนะนำ v14+)
2. ติดตั้ง dependencies
   ```bash
   npm install
   ```

## การใช้งาน

1. เสียบเครื่องอ่าน ACR122U เข้ากับคอมพิวเตอร์
2. รันเซิร์ฟเวอร์
   ```bash
   npm start
   ```
   หรือสำหรับโหมด dev (auto-reload)
   ```bash
   npm run dev
   ```
3. เปิดเว็บเบราว์เซอร์ไปที่  
   [http://localhost:3007](http://localhost:3007)

## REST API ที่สำคัญ

- `GET /reader-status` : ตรวจสอบสถานะเครื่องอ่านและบัตร
- `GET /card-info` : ข้อมูลบัตร (UID, ATR, type)
- `GET /read-uid` : อ่าน UID
- `GET /read-uid-le` : อ่าน UID แบบ Little Endian
- `POST /read-sector` : อ่านข้อมูล sector (ต้องระบุ sectorNumber, keyType, key)
- `POST /write-sector` : เขียนข้อมูล sector

## Dependencies หลัก

- express
- body-parser
- nfc-pcsc

## หมายเหตุ

- รองรับเฉพาะบัตร MIFARE Classic
- ต้องใช้เครื่องอ่าน ACR122U ที่เชื่อมต่อกับเครื่อง 

## ดาวน์โหลดไดรเวอร์ ACR122U (Windows)

- **MSI Installer for PC/SC Driver**
- ขนาดไฟล์: 5.22 MB
- เวอร์ชัน: 4.2.8.0 (20-Mar-2018)
- รองรับ: Windows® XP, Vista, 7, 8, 8.1, 10, 11, Server 2003, 2008, 2008 R2, 2012, 2012 R2, 2016 R2
- ดาวน์โหลด: [ACS Unified MSI 4.2.8.0 (RAR)](https://www.acs.com.hk/download-driver-unified/9840/ACS-Unified-MSI-4280.rar) 
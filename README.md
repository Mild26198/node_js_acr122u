# ACR122U Web Server - Windows Service

เว็บเซิร์ฟเวอร์สำหรับอ่านและเขียนข้อมูล MIFARE ด้วย ACR122U reader พร้อมระบบ Windows Service ที่สมบูรณ์

## ✨ คุณสมบัติ

- 🔐 อ่านและเขียนข้อมูล MIFARE cards
- 🌐 เว็บอินเตอร์เฟสที่ใช้งานง่าย
- 🖥️ Windows Service ที่ทำงานอัตโนมัติ
- 📱 เข้าถึงได้ผ่านเว็บเบราว์เซอร์
- 🔧 ระบบจัดการบริการที่ครบครัน

## 🚀 การติดตั้ง

### วิธีที่ 1: ติดตั้งแบบ Windows Service (แนะนำ)

1. **ติดตั้ง dependencies:**
   ```bash
   npm install
   ```

2. **สร้าง installer:**
   ```bash
   npm run build-installer
   ```

3. **ติดตั้งบริการ:**
   - ไปที่โฟลเดอร์ `dist/`
   - คลิกขวาที่ `install.bat` และเลือก "Run as administrator"
   - รอให้การติดตั้งเสร็จสิ้น

4. **เข้าถึงเว็บไซต์:**
   - เปิดเบราว์เซอร์ไปที่: http://localhost:3007

### วิธีที่ 2: ใช้ Service Manager

1. **รัน Service Manager:**
   ```bash
   npm run service-manager
   ```

2. **เลือกตัวเลือกที่ต้องการ:**
   - ติดตั้งบริการ
   - เริ่ม/หยุดบริการ
   - ดูสถานะบริการ

### วิธีที่ 3: ติดตั้งแบบปกติ

1. **ติดตั้ง dependencies:**
   ```bash
   npm install
   ```

2. **เริ่มต้นเซิร์ฟเวอร์:**
   ```bash
   npm start
   ```

3. **เข้าถึงเว็บไซต์:**
   - เปิดเบราว์เซอร์ไปที่: http://localhost:3007

## 📋 คำสั่งที่มีประโยชน์

### การจัดการ Windows Service

```bash
# ติดตั้งบริการ
npm run install-service

# ถอนการติดตั้งบริการ
npm run uninstall-service

# เริ่มบริการ
net start "ACR122U Web Server"

# หยุดบริการ
net stop "ACR122U Web Server"

# ดูสถานะบริการ
sc query "ACR122U Web Server"
```

### การพัฒนา

```bash
# เริ่มต้นในโหมดพัฒนา
npm run dev

# สร้าง executable
npm run build

# รัน Service Manager
npm run service-manager
```

## 🛠️ การแก้ไขปัญหา

### บริการไม่เริ่มต้น
1. ตรวจสอบว่า ACR122U reader เชื่อมต่ออยู่
2. ตรวจสอบสิทธิ์ Administrator
3. ดู log ใน Event Viewer

### ไม่สามารถเข้าถึงเว็บไซต์
1. ตรวจสอบว่า port 3007 ไม่ถูกใช้งาน
2. ตรวจสอบ Windows Firewall
3. ตรวจสอบสถานะบริการ

### ข้อผิดพลาดเกี่ยวกับ NFC
1. ตรวจสอบ driver ของ ACR122U
2. ตรวจสอบการเชื่อมต่อ USB
3. รีสตาร์ทบริการ

## 📁 โครงสร้างโปรเจค

```
NodeJS_ACR122U/
├── app.js                 # Express application
├── server.js              # Server entry point
├── nfc.js                 # NFC reader/writer logic
├── install-service.js      # Windows Service installer
├── uninstall-service.js    # Windows Service uninstaller
├── service-manager.js      # Service management tool
├── build-installer.js      # Installer builder
├── package.json           # Dependencies and scripts
├── public/                # Static web files
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── routes/                # API routes
│   ├── status.js
│   └── sector.js
└── dist/                  # Generated installer files
    ├── install.bat
    ├── uninstall.bat
    └── README.txt
```

## 🔧 การกำหนดค่า

### Environment Variables

- `PORT`: Port ที่ใช้ (default: 3007)
- `NODE_ENV`: Environment (production/development)

### การเปลี่ยน Port

1. **แก้ไขใน server.js:**
   ```javascript
   const PORT = process.env.PORT || 3007;
   ```

2. **หรือตั้งค่า environment variable:**
   ```bash
   set PORT=8080
   npm start
   ```

## 📞 การสนับสนุน

หากพบปัญหา กรุณาตรวจสอบ:

1. **Log files:** ดู log ใน Event Viewer
2. **Service status:** ใช้ `sc query "ACR122U Web Server"`
3. **Web interface:** เข้าถึง http://localhost:3007/status

## 📄 License

ISC License

---

**หมายเหตุ:** โปรเจคนี้ต้องการสิทธิ์ Administrator สำหรับการติดตั้ง Windows Service 
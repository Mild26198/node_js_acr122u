@echo off
echo Creating NodeJS ACR122U Setup...

REM สร้างโฟลเดอร์สำหรับ setup
if not exist "setup-files" mkdir setup-files
if not exist "setup-files\NodeJS_ACR122U" mkdir setup-files\NodeJS_ACR122U

REM Copy ไฟล์ที่จำเป็น
echo Copying files...
xcopy /E /I /Y "server.js" "setup-files\NodeJS_ACR122U\"
xcopy /E /I /Y "app.js" "setup-files\NodeJS_ACR122U\"
xcopy /E /I /Y "nfc.js" "setup-files\NodeJS_ACR122U\"
xcopy /E /I /Y "package.json" "setup-files\NodeJS_ACR122U\"
xcopy /E /I /Y "package-lock.json" "setup-files\NodeJS_ACR122U\"
xcopy /E /I /Y "install-service.js" "setup-files\NodeJS_ACR122U\"
xcopy /E /I /Y "uninstall-service.js" "setup-files\NodeJS_ACR122U\"
xcopy /E /I /Y "public" "setup-files\NodeJS_ACR122U\public\"
xcopy /E /I /Y "routes" "setup-files\NodeJS_ACR122U\routes\"
xcopy /E /I /Y "node_modules" "setup-files\NodeJS_ACR122U\node_modules\"

REM สร้างไฟล์ README
echo Creating README...
echo NodeJS ACR122U Access Control System > setup-files\README.txt
echo. >> setup-files\README.txt
echo Installation Instructions: >> setup-files\README.txt
echo 1. Extract all files to C:\Program Files\NodeJS_ACR122U\ >> setup-files\README.txt
echo 2. Open Command Prompt as Administrator >> setup-files\README.txt
echo 3. Navigate to the installation directory >> setup-files\README.txt
echo 4. Run: node install-service.js >> setup-files\README.txt
echo 5. The service will start automatically >> setup-files\README.txt
echo 6. Open http://localhost:3007 in your browser >> setup-files\README.txt
echo. >> setup-files\README.txt
echo To uninstall service: >> setup-files\README.txt
echo Run: node uninstall-service.js >> setup-files\README.txt

REM สร้างไฟล์ install.bat
echo Creating install.bat...
echo @echo off > setup-files\install.bat
echo echo Installing NodeJS ACR122U Service... >> setup-files\install.bat
echo node install-service.js >> setup-files\install.bat
echo echo Service installed successfully! >> setup-files\install.bat
echo echo Open http://localhost:3007 in your browser >> setup-files\install.bat
echo pause >> setup-files\install.bat

REM สร้างไฟล์ uninstall.bat
echo Creating uninstall.bat...
echo @echo off > setup-files\uninstall.bat
echo echo Uninstalling NodeJS ACR122U Service... >> setup-files\uninstall.bat
echo node uninstall-service.js >> setup-files\uninstall.bat
echo echo Service uninstalled successfully! >> setup-files\uninstall.bat
echo pause >> setup-files\uninstall.bat

echo Setup files created successfully!
echo Location: setup-files\NodeJS_ACR122U\
echo.
echo To create installer:
echo 1. Download Inno Setup from https://jrsoftware.org/isinfo.php
echo 2. Install Inno Setup
echo 3. Open setup.iss in Inno Setup Compiler
echo 4. Press F9 to compile
echo.
pause 
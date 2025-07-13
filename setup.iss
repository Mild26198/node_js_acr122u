[Setup]
AppName=NodeJS ACR122U Access Control
AppVersion=1.0
DefaultDirName={pf}\NodeJS_ACR122U
DefaultGroupName=NodeJS ACR122U
OutputDir=output
OutputBaseFilename=NodeJS_ACR122U_Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "installservice"; Description: "Install as Windows Service"; GroupDescription: "Service Installation"; Flags: checkedonce

[Files]
; Main executable
Source: "dist\acr122u.exe"; DestDir: "{app}"; Flags: ignoreversion

; Service scripts
Source: "setup-files\install-service.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "setup-files\uninstall-service.bat"; DestDir: "{app}"; Flags: ignoreversion

; Native modules
Source: "node_modules\@pokusew\pcsclite\build\Release\pcsclite.node"; DestDir: "{app}\node_modules\@pokusew\pcsclite\build\Release"; Flags: ignoreversion

; Required node_modules (only the essential ones)
Source: "node_modules\nfc-pcsc\**"; DestDir: "{app}\node_modules\nfc-pcsc"; Flags: ignoreversion recursesubdirs
Source: "node_modules\@pokusew\pcsclite\**"; DestDir: "{app}\node_modules\@pokusew\pcsclite"; Flags: ignoreversion recursesubdirs
Source: "node_modules\node-windows\**"; DestDir: "{app}\node_modules\node-windows"; Flags: ignoreversion recursesubdirs

; Web files
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs
Source: "routes\*"; DestDir: "{app}\routes"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\ACR122U Access Control"; Filename: "{app}\acr122u.exe"
Name: "{group}\Services"; Filename: "services.msc"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"

[Run]
; ติดตั้ง Service ผ่าน batch file
Filename: "{app}\install-service.bat"; StatusMsg: "กำลังติดตั้ง Service..."; Flags: runhidden waituntilterminated; Tasks: installservice
; เปิด services.msc
Filename: "services.msc"; Description: "เปิดตัวจัดการ Services"; Flags: postinstall shellexec nowait unchecked
; เปิดเว็บ
Filename: "http://localhost:3007"; Description: "เปิดเว็บแอพพลิเคชัน"; Flags: postinstall shellexec unchecked

[UninstallRun]
; ถอนการติดตั้ง Service ผ่าน batch file
Filename: "{app}\uninstall-service.bat"; StatusMsg: "กำลังถอนการติดตั้ง Service..."; Flags: runhidden waituntilterminated

[Code]
function CheckPort3007(): Boolean;
var
  ResultCode: Integer;
begin
  Result := False;
  if Exec(ExpandConstant('{cmd}'), '/c netstat -an | find "3007"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := (ResultCode = 0);
  end;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  
  // ตรวจสอบ Port 3007
  if CheckPort3007() then
  begin
    if MsgBox('Port 3007 กำลังถูกใช้งานอยู่' + #13#10 +
              'การติดตั้งอาจทำให้เกิดปัญหาได้' + #13#10#13#10 +
              'ต้องการดำเนินการติดตั้งต่อหรือไม่?', 
              mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;
end; 
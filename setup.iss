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
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installservice"; Description: "Install as Windows Service"; GroupDescription: "Service Installation"; Flags: checkedonce

[Files]
Source: "server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "app.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "nfc.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-service.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall-service.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs
Source: "routes\*"; DestDir: "{app}\routes"; Flags: ignoreversion recursesubdirs
Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\NodeJS ACR122U Service"; Filename: "{app}\server.js"; IconFilename: "{app}\public\favicon.ico"
Name: "{group}\Install Service"; Filename: "{app}\install-service.js"
Name: "{group}\Uninstall Service"; Filename: "{app}\uninstall-service.js"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"
Name: "{commondesktop}\NodeJS ACR122U"; Filename: "{app}\server.js"; IconFilename: "{app}\public\favicon.ico"; Tasks: desktopicon

[Run]
Filename: "cmd.exe"; Parameters: "/c cd /d ""{app}"" && node install-service.js"; Description: "Install as Windows Service"; Flags: runhidden; Tasks: installservice
Filename: "http://localhost:3007"; Description: "Open Web Interface"; Flags: postinstall shellexec

[UninstallRun]
Filename: "cmd.exe"; Parameters: "/c cd /d ""{app}"" && node uninstall-service.js"; Flags: runhidden

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end; 
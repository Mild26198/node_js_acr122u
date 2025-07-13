[Setup]
AppName=ACR122U Card Reader Service
AppVersion=1.0.0
AppPublisher=Your Company
AppPublisherURL=https://yourcompany.com
AppSupportURL=https://yourcompany.com/support
AppUpdatesURL=https://yourcompany.com/updates
DefaultDirName={autopf}\ACR122U Service
DefaultGroupName=ACR122U Service
AllowNoIcons=yes
; LicenseFile=license.txt
; NOTE: The value of AppId uniquely identifies this application.
AppId={{12345678-1234-1234-1234-123456789012}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
; Require administrator privileges
PrivilegesRequired=admin
OutputDir=Output
OutputBaseFilename=ACR122U_Service_Setup
; SetupIconFile=icon.ico
UninstallDisplayIcon={app}\acr122u.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; Main application files
Source: "acr122u.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
; Add any additional files your service needs
; Source: "config.json"; DestDir: "{app}"; Flags: ignoreversion; Check: FileExists('config.json')
; Source: "node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs; Check: DirExists('node_modules')

[Icons]
Name: "{group}\Uninstall ACR122U Service"; Filename: "{uninstallexe}"
Name: "{group}\Service Manager"; Filename: "{sys}\services.msc"

[Code]
const
  SERVICE_NAME = 'ACR122UService';
  SERVICE_DISPLAY_NAME = 'ACR122U Card Reader Service';
  SERVICE_DESCRIPTION = 'Service for ACR122U NFC Card Reader management';

function IsServiceInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{app}\nssm.exe'), 'status "' + SERVICE_NAME + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function InstallService(): Boolean;
var
  ResultCode: Integer;
  ServicePath: String;
begin
  Result := True;
  ServicePath := ExpandConstant('{app}\acr122u.exe');
  
  // Install the service
  if not Exec(ExpandConstant('{app}\nssm.exe'), 
    'install "' + SERVICE_NAME + '" "' + ServicePath + '"', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Failed to install service. Error code: ' + IntToStr(ResultCode), mbError, MB_OK);
    Result := False;
    Exit;
  end;
  
  // Set service display name
  Exec(ExpandConstant('{app}\nssm.exe'), 
    'set "' + SERVICE_NAME + '" DisplayName "' + SERVICE_DISPLAY_NAME + '"', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Set service description
  Exec(ExpandConstant('{app}\nssm.exe'), 
    'set "' + SERVICE_NAME + '" Description "' + SERVICE_DESCRIPTION + '"', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Set service to start automatically
  Exec(ExpandConstant('{app}\nssm.exe'), 
    'set "' + SERVICE_NAME + '" Start SERVICE_AUTO_START', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Set working directory
  Exec(ExpandConstant('{app}\nssm.exe'), 
    'set "' + SERVICE_NAME + '" AppDirectory "' + ExpandConstant('{app}') + '"', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Start the service
  if not Exec(ExpandConstant('{app}\nssm.exe'), 
    'start "' + SERVICE_NAME + '"', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Service installed but failed to start. You can start it manually from Services.', mbInformation, MB_OK);
  end;
end;

function UninstallService(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  
  // Stop the service
  Exec(ExpandConstant('{app}\nssm.exe'), 
    'stop "' + SERVICE_NAME + '"', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // Remove the service
  if not Exec(ExpandConstant('{app}\nssm.exe'), 
    'remove "' + SERVICE_NAME + '" confirm', 
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Failed to remove service. You may need to remove it manually.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Check if service already exists
    if IsServiceInstalled() then
    begin
      if MsgBox('Service already exists. Do you want to reinstall it?', mbConfirmation, MB_YESNO) = IDYES then
      begin
        UninstallService();
        Sleep(2000); // Wait a bit
        InstallService();
      end;
    end
    else
    begin
      InstallService();
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    if IsServiceInstalled() then
    begin
      UninstallService();
    end;
  end;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  
  // Check if running as administrator
  if not IsAdminInstallMode() then
  begin
    MsgBox('This installer requires administrator privileges to install Windows services.', mbError, MB_OK);
    Result := False;
  end;
end;
[Setup]
AppName=MIConecta Agent
AppVersion=1.0.0
AppPublisher=Maginf Tecnologia
AppPublisherURL=https://maginf.com.br
DefaultDirName={pf}\MIConecta
DefaultGroupName=MIConecta
OutputBaseFilename=MIConectaSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=assets\miconecta.ico
WizardImageFile=assets\installer-banner.png
WizardSmallImageFile=assets\installer-banner.png
UninstallDisplayIcon={app}\MIConectaAgent.exe

[Files]
Source: "..\agent\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Run]
; Instalar como serviço do Windows
Filename: "sc.exe"; Parameters: "create MIConectaRMMAgent binpath=""{app}\MIConectaAgent.exe"" start=auto displayname=""MIConecta Agent"""; Flags: runhidden
Filename: "sc.exe"; Parameters: "description MIConectaRMMAgent ""Agente de monitoramento e suporte remoto da MIConecta"""; Flags: runhidden
Filename: "sc.exe"; Parameters: "start MIConectaRMMAgent"; Flags: runhidden

; Configurar RustDesk (se instalado)
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""$configDir = Join-Path $env:APPDATA 'RustDesk\config'; if (Test-Path $configDir) {{ $toml = Join-Path $configDir 'RustDesk2.toml'; $content = 'rendezvous_server = \'136.248.114.218\'' + [Environment]::NewLine + 'key = \'ev3ic04E+VsgunfupaellTSWgSzmHiQL2H5ywzBE+yI=\''; Set-Content -Path $toml -Value $content }}"""; Flags: runhidden

[UninstallRun]
Filename: "sc.exe"; Parameters: "stop MIConectaRMMAgent"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete MIConectaRMMAgent"; Flags: runhidden

[Code]
var
  ServerPage: TInputQueryWizardPage;
  TenantPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ServerPage := CreateInputQueryPage(wpSelectDir,
  'Servidor MIConecta', 'Configure a conexão com a plataforma',
  'Informe a URL da API da MIConecta:');
  ServerPage.Add('URL do Servidor:', False);
  ServerPage.Values[0] := 'https://api.maginf.com.br/api/v1';

  TenantPage := CreateInputQueryPage(ServerPage.ID,
  'Identificação do cliente', 'Configure os dados de vínculo do agente',
  'Informe os identificadores fornecidos pela MIConecta:');
  TenantPage.Add('Tenant ID:', False);
  TenantPage.Add('Organization ID:', False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFile: string;
begin
  if CurStep = ssPostInstall then
  begin
  ConfigFile := ExpandConstant('{pf}\MIConecta\agent.config');
    SaveStringToFile(ConfigFile,
      'ServerUrl=' + ServerPage.Values[0] + #13#10 +
      'TenantId=' + TenantPage.Values[0] + #13#10 +
      'OrganizationId=' + TenantPage.Values[1] + #13#10 +
      'RustDeskServer=136.248.114.218' + #13#10 +
      'RustDeskKey=ev3ic04E+VsgunfupaellTSWgSzmHiQL2H5ywzBE+yI=' + #13#10 +
      'HeartbeatIntervalSeconds=60' + #13#10,
      False);
  end;
end;

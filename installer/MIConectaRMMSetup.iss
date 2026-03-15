[Setup]
AppName=MIConectaRMM Agent
AppVersion=1.0.0
AppPublisher=Maginf Tecnologia
AppPublisherURL=https://maginf.com.br
DefaultDirName={pf}\MIConectaRMM
DefaultGroupName=MIConectaRMM
OutputBaseFilename=MIConectaRMMSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\MIConectaAgent.exe

[Files]
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Run]
; Instalar como serviço do Windows
Filename: "sc.exe"; Parameters: "create MIConectaRMMAgent binpath=""{app}\MIConectaAgent.exe"" start=auto displayname=""MIConectaRMM Agent"""; Flags: runhidden
Filename: "sc.exe"; Parameters: "description MIConectaRMMAgent ""Agente de monitoramento remoto MIConectaRMM by Maginf Tecnologia"""; Flags: runhidden
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
    'Servidor MIConectaRMM', 'Configure a conexão com o servidor',
    'Informe a URL do servidor MIConectaRMM:');
  ServerPage.Add('URL do Servidor:', False);
  ServerPage.Values[0] := 'http://seu-servidor:3000/api/v1';

  TenantPage := CreateInputQueryPage(ServerPage.ID,
    'Identificação do Cliente', 'Configure o tenant e organização',
    'Informe os IDs de identificação:');
  TenantPage.Add('Tenant ID:', False);
  TenantPage.Add('Organization ID:', False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFile: string;
begin
  if CurStep = ssPostInstall then
  begin
    ConfigFile := ExpandConstant('{pf}\MIConectaRMM\agent.config');
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

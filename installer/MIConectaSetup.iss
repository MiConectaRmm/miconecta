; MIConecta Agent — esqueleto Inno Setup 6 (referência; pipeline oficial = WiX em ..\build-agent.ps1)
; Ajuste AppSourceDir para a pasta de publish (multi-ficheiro) do agente + tray antes de compilar.

#define MyAppName "MIConecta Agent"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "Maginf Tecnologia"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\MIConecta
DefaultGroupName={#MyAppName}
OutputDir=.\output
OutputBaseFilename=MIConectaSetup-Inno
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
; TODO: apontar para publish real (ex.: ..\agent\MIConectaAgent\bin\Release\net8.0-windows\win-x64\publish\)
; Source: "..\agent\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

[Run]
; Registrar e iniciar serviço Windows — alinhar nome do serviço ao instalado pelo MSI oficial
; Filename: "sc.exe"; Parameters: "create MIConectaRMMAgent binPath= ""{app}\MIConectaAgent.exe"" start= auto"; Flags: runhidden
; Filename: "sc.exe"; Parameters: "start MIConectaRMMAgent"; Flags: runhidden

[Icons]
; Name: "{group}\MIConecta Tray"; Filename: "{app}\MIConectaTray.exe"; WorkingDir: "{app}"

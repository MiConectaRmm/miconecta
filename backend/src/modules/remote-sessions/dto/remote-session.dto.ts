import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Políticas de acesso ──

export enum AccessPolicyType {
  SERVIDOR = 'servidor',
  ESTACAO = 'estacao',
}

/**
 * Política de acesso remoto diferenciada por tipo de dispositivo.
 * Servidores exigem mais controles que estações de trabalho.
 */
export class AccessPolicyDto {
  @ApiProperty({ enum: AccessPolicyType })
  tipo: AccessPolicyType;

  @ApiProperty({ description: 'Exige consentimento do usuário local?' })
  exigeConsentimento: boolean;

  @ApiProperty({ description: 'Timeout para consentimento (segundos)' })
  consentimentoTimeoutSegundos: number;

  @ApiProperty({ description: 'Gravação obrigatória?' })
  gravacaoObrigatoria: boolean;

  @ApiProperty({ description: 'Screenshot automático ao conectar?' })
  screenshotAutoConexao: boolean;

  @ApiProperty({ description: 'Screenshot automático ao desconectar?' })
  screenshotAutoDesconexao: boolean;

  @ApiProperty({ description: 'Máximo de sessões simultâneas no device' })
  maxSessoesSimultaneas: number;

  @ApiProperty({ description: 'Horários permitidos (null = qualquer horário)' })
  horariosPermitidos: { inicio: string; fim: string } | null;

  @ApiProperty({ description: 'Roles que podem acessar' })
  rolesPermitidos: string[];

  @ApiProperty({ description: 'Exige ticket vinculado?' })
  exigeTicket: boolean;

  @ApiProperty({ description: 'Exige motivo obrigatório?' })
  exigeMotivo: boolean;

  @ApiProperty({ description: 'Notificar admin/gestor ao iniciar?' })
  notificarAdmin: boolean;
}

// ── Solicitar sessão ──

export class SolicitarSessaoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ticketId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({ description: 'Solicitar gravação da sessão' })
  @IsOptional()
  @IsBoolean()
  gravarSessao?: boolean;
}

// ── Consentimento (vindo do agente) ──

export class ConsentimentoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  consentido: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  usuarioLocal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hostname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

// ── Finalizar sessão ──

export class FinalizarSessaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resumo?: string;

  @ApiPropertyOptional({ description: 'URL da gravação da sessão' })
  @IsOptional()
  @IsString()
  gravacaoUrl?: string;

  @ApiPropertyOptional({ description: 'Tamanho da gravação em bytes' })
  @IsOptional()
  gravacaoTamanho?: number;
}

// ── Evidência ──

export class RegistrarEvidenciaDto {
  @ApiProperty({ enum: ['screenshot', 'gravacao', 'arquivo_transferido', 'clipboard', 'log_comando'] })
  @IsNotEmpty()
  @IsString()
  tipo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descricao: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  arquivoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  arquivoNome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  arquivoTamanho?: number;

  @ApiPropertyOptional()
  @IsOptional()
  detalhes?: Record<string, any>;
}

// ── Resposta detalhada de sessão ──

export class SessionDetailDto {
  id: string;
  tenantId: string;
  ticketId: string | null;
  deviceId: string;
  technicianId: string;
  status: string;
  motivo: string | null;
  consentidoPor: string | null;
  consentidoEm: Date | null;
  iniciadaEm: Date | null;
  finalizadaEm: Date | null;
  duracaoSegundos: number | null;
  gravacaoUrl: string | null;
  gravacaoTamanho: number | null;
  resumo: string | null;
  criadoEm: Date;

  // Relations
  device?: { id: string; hostname: string; ipLocal: string; status: string };
  technician?: { id: string; nome: string; email: string };
  ticket?: { id: string; numero: number; titulo: string; status: string };

  // Computed
  politicaAplicada?: AccessPolicyDto;
  totalLogs?: number;
  totalEvidencias?: number;
}

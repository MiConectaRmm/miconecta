interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  online: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Online' },
  offline: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Offline' },
  alerta: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Alerta' },
  manutencao: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Manutenção' },
  aberto: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Aberto' },
  em_atendimento: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Em Atendimento' },
  aguardando_cliente: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Aguardando Cliente' },
  aguardando_tecnico: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Aguardando Técnico' },
  resolvido: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Resolvido' },
  fechado: { bg: 'bg-dark-500/20', text: 'text-dark-400', label: 'Fechado' },
  cancelado: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Cancelado' },
  ativo: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Ativo' },
  suspenso: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Suspenso' },
  trial: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Trial' },
  baixa: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Baixa' },
  media: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Média' },
  alta: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Alta' },
  urgente: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Urgente' },
  critico: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Crítico' },
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_MAP[status] || { bg: 'bg-dark-500/20', text: 'text-dark-400', label: status }
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span className={`${config.bg} ${config.text} ${sizeClass} rounded-full font-medium inline-flex items-center gap-1`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.text.replace('text-', 'bg-')}`} />
      {config.label}
    </span>
  )
}

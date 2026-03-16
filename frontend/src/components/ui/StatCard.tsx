import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color?: 'brand' | 'emerald' | 'red' | 'amber' | 'blue' | 'purple'
  subtitle?: string
  trend?: { value: number; positive: boolean }
}

const colorMap = {
  brand: 'bg-brand-600/20 text-brand-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  red: 'bg-red-500/20 text-red-400',
  amber: 'bg-amber-500/20 text-amber-400',
  blue: 'bg-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/20 text-purple-400',
}

export default function StatCard({ title, value, icon: Icon, color = 'brand', subtitle, trend }: StatCardProps) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-dark-400 text-sm">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-dark-500 text-xs mt-1">{subtitle}</p>}
        {trend && (
          <p className={`text-xs mt-1 ${trend.positive ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  )
}

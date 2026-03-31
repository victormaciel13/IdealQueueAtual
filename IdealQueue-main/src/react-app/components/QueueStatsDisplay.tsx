import { Card, CardContent } from '@/react-app/components/ui/card';
import { Users, Clock, Heart, UserCheck } from 'lucide-react';
import type { QueueStats } from '@/shared/types';

interface StatsProps {
  stats: QueueStats;
}

export function QueueStatsDisplay({ stats }: StatsProps) {
  const statCards = [
    {
      label: 'Aguardando Recepção',
      value: stats.total_waiting_reception,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      label: 'Em Atendimento (Guichês)',
      value: stats.total_in_guiche,
      icon: UserCheck,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    {
      label: 'Aguardando DP',
      value: stats.total_waiting_dp,
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50'
    },
    {
      label: 'Prioritários na Fila',
      value: stats.priority_waiting,
      icon: Heart,
      color: 'text-pink-600',
      bg: 'bg-pink-50'
    },
    {
      label: 'Tempo Médio de Espera',
      value: `${stats.average_wait_minutes} min`,
      icon: Clock,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {statCards.map((stat, idx) => (
        <Card key={idx} className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

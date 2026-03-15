import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string | number
  gradient?: string
}

export function StatCard({
  label,
  value,
  gradient = 'from-purple-400 to-blue-400',
}: StatCardProps) {
  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
      <CardContent className="p-5 text-center">
        <div
          className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  )
}

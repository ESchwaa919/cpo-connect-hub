import { DailyVolumeChart } from './DailyVolumeChart'
import { ContributorsChart } from './ContributorsChart'
import { SentimentChart } from './SentimentChart'
import { TrendItem } from './TrendItem'

type TagVariant = 'hot' | 'green' | 'gold' | 'amber' | 'pink' | 'blue'

export interface ChannelData {
  name: string
  dailyVolume: { day: string; messages: number }[]
  contributors: { name: string; messages: number; color: string }[]
  sentiment: { label: string; value: number }[]
  trends: {
    title: string
    description: string
    tags?: { label: string; variant: TagVariant }[]
    dateRange?: string
  }[]
  chartColor?: string
  sentimentColor?: string
}

interface ChannelSectionProps {
  data: ChannelData
}

export function ChannelSection({ data }: ChannelSectionProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <DailyVolumeChart data={data.dailyVolume} color={data.chartColor} />
        <ContributorsChart data={data.contributors} />
      </div>

      <SentimentChart data={data.sentiment} color={data.sentimentColor} />

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-purple-300">
          Key Trends &amp; Themes
        </h3>
        {data.trends.map((trend, i) => (
          <TrendItem
            key={i}
            rank={i + 1}
            title={trend.title}
            description={trend.description}
            tags={trend.tags}
            dateRange={trend.dateRange}
          />
        ))}
      </div>
    </div>
  )
}

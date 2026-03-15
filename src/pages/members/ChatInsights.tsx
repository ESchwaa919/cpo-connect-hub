import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { months, defaultMonth } from '@/data/insights/config'

export default function ChatInsights() {
  const defaultIndex = months.findIndex((m) => m.id === defaultMonth)
  const [currentIndex, setCurrentIndex] = useState(defaultIndex >= 0 ? defaultIndex : 0)

  const currentMonth = months[currentIndex]
  const MonthComponent = currentMonth.component

  const isOldest = currentIndex === months.length - 1
  const isNewest = currentIndex === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold font-display">Chat Insights</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentIndex((i) => i + 1)}
            disabled={isOldest}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {currentMonth.label}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentIndex((i) => i - 1)}
            disabled={isNewest}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <React.Suspense
        fallback={
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <MonthComponent />
      </React.Suspense>
    </div>
  )
}

import { Linkedin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MemberCardProps {
  name: string
  role: string
  currentOrg?: string
  sector?: string
  focusAreas?: string[]
  linkedIn?: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function MemberCard({ name, role, currentOrg, sector, focusAreas, linkedIn }: MemberCardProps) {
  return (
    <Card
      className={cn(
        "bg-card/50 border-border/50 backdrop-blur-sm",
        "hover:border-primary/30 transition-colors"
      )}
    >
      <CardContent className="p-4 flex items-start gap-4">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{name}</span>
            {linkedIn && (
              <a
                href={linkedIn}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                aria-label={`${name} on LinkedIn`}
              >
                <Linkedin className="h-4 w-4" />
              </a>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-0.5 truncate">{role}</p>

          {currentOrg && (
            <p className="text-xs text-muted-foreground truncate">{currentOrg}</p>
          )}
          {sector && (
            <Badge variant="outline" className="text-xs mt-1">{sector}</Badge>
          )}

          {focusAreas && focusAreas.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {focusAreas.map((area) => (
                <Badge key={area} variant="secondary" className="text-xs">
                  {area.trim()}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

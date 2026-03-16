import { Linkedin, Mail, Phone, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { MemberAvatar } from "./MemberAvatar"

interface MemberCardProps {
  name: string
  role: string
  currentOrg?: string
  sector?: string
  focusAreas?: string[]
  linkedIn?: string
  email?: string
  phone?: string
  bio?: string
  skills?: string[]
  areasOfInterest?: string[]
  location?: string
  gravatarUrl?: string
  photoUrl?: string
  expanded?: boolean
  onToggle?: () => void
}

export function MemberCard({
  name, role, currentOrg, sector, focusAreas, linkedIn,
  email, phone, bio, skills, areasOfInterest, location,
  gravatarUrl, photoUrl, expanded, onToggle,
}: MemberCardProps) {
  return (
    <Card
      className={cn(
        "bg-card/50 border-border/50 backdrop-blur-sm transition-colors",
        expanded ? "border-primary/40" : "hover:border-primary/30",
        onToggle && "cursor-pointer"
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <MemberAvatar
            name={name}
            photoUrl={photoUrl}
            gravatarUrl={gravatarUrl}
            size={expanded ? 80 : 48}
            className="shrink-0"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm truncate">{name}</span>
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {linkedIn && (
                  <a href={linkedIn} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label={`${name} on LinkedIn`}>
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
                {email && (
                  <a href={`mailto:${email}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label={`Email ${name}`}>
                    <Mail className="h-4 w-4" />
                  </a>
                )}
                {phone && (
                  <a href={`tel:${phone}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    aria-label={`Call ${name}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
              {expanded && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle?.() }}
                  className="ml-auto text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground mt-0.5 truncate">{role}</p>
            {currentOrg && <p className="text-xs text-muted-foreground truncate">{currentOrg}</p>}
            {sector && <Badge variant="outline" className="text-xs mt-1">{sector}</Badge>}

            {focusAreas && focusAreas.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {focusAreas.map((area) => (
                  <Badge key={area} variant="secondary" className="text-xs">{area.trim()}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-border/50 space-y-3 text-sm">
                {bio && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bio</span>
                    <p className="mt-1 text-foreground/90">{bio}</p>
                  </div>
                )}

                {skills && skills.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Skills</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {skills.map((skill) => (
                        <Badge key={skill} className="text-xs bg-accent/20 text-accent-foreground border-accent/30">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {areasOfInterest && areasOfInterest.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interests</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {areasOfInterest.map((area) => (
                        <Badge key={area} variant="outline" className="text-xs">{area}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {location && (
                  <p className="text-xs text-muted-foreground">Location: {location}</p>
                )}

                <div className="flex flex-col gap-1 text-xs" onClick={(e) => e.stopPropagation()}>
                  {email && (
                    <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`} className="text-primary hover:underline">{phone}</a>
                  )}
                  {linkedIn && (
                    <a href={linkedIn} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{linkedIn}</a>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}

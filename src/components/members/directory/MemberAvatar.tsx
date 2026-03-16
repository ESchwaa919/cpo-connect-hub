import { useState } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn, getInitials } from "@/lib/utils"

interface MemberAvatarProps {
  name: string
  founderPhoto?: string
  gravatarUrl?: string
  size?: number
  className?: string
}

const FOUNDER_PHOTOS: Record<string, string> = {
  'erik schwartz': '/founders/erik-schwartz.jpeg',
  'glynn williams': '/founders/glynn-williams.jpeg',
  'gokul raju': '/founders/gokul-raju.png',
  'gregor young': '/founders/gregor-young.jpeg',
  'james engelbert': '/founders/james-engelbert.jpeg',
  'jessie rushton': '/founders/jessie-rushton.jpeg',
  'sarah baker-white': '/founders/sarah-baker-white.jpeg',
  'scott weiss': '/founders/scott-weiss.jpeg',
  'shiv khuti': '/founders/shiv-khuti.jpeg',
}

function normaliseForMatch(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function uiAvatarsUrl(name: string, size: number): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&size=${size}&bold=true`
}

export function getFounderPhoto(name: string): string | undefined {
  return FOUNDER_PHOTOS[normaliseForMatch(name)]
}

export function MemberAvatar({ name, founderPhoto, gravatarUrl, size = 40, className }: MemberAvatarProps) {
  const resolvedFounderPhoto = founderPhoto ?? getFounderPhoto(name)
  const [imgSrc, setImgSrc] = useState<string | undefined>(
    resolvedFounderPhoto ?? gravatarUrl ?? uiAvatarsUrl(name, size)
  )

  const sizeClass = size <= 32 ? "h-8 w-8" : size <= 48 ? "h-12 w-12" : "h-20 w-20"

  function handleError() {
    if (imgSrc === resolvedFounderPhoto && gravatarUrl) {
      setImgSrc(gravatarUrl)
    } else if (imgSrc === resolvedFounderPhoto || imgSrc === gravatarUrl) {
      setImgSrc(uiAvatarsUrl(name, size))
    } else {
      setImgSrc(undefined) // fall through to initials
    }
  }

  return (
    <Avatar className={cn(sizeClass, className)}>
      {imgSrc && (
        <AvatarImage
          src={imgSrc}
          alt={name}
          className="object-cover"
          onLoadingStatusChange={(status) => {
            if (status === 'error') handleError()
          }}
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

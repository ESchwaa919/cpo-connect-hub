import { useState } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn, getInitials } from "@/lib/utils"

interface MemberAvatarProps {
  name: string
  photoUrl?: string
  gravatarUrl?: string
  size?: number
  className?: string
}

function uiAvatarsUrl(name: string, size: number): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff&size=${size}&bold=true`
}

export function MemberAvatar({ name, photoUrl, gravatarUrl, size = 40, className }: MemberAvatarProps) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(
    photoUrl ?? gravatarUrl ?? uiAvatarsUrl(name, size)
  )

  const sizeClass = size <= 32 ? "h-8 w-8" : size <= 48 ? "h-12 w-12" : "h-20 w-20"

  function handleError() {
    if (imgSrc === photoUrl && gravatarUrl) {
      setImgSrc(gravatarUrl)
    } else if (imgSrc !== uiAvatarsUrl(name, size)) {
      setImgSrc(uiAvatarsUrl(name, size))
    } else {
      setImgSrc(undefined)
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

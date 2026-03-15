import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MemberCard } from "@/components/members/directory/MemberCard"

interface RawMember {
  [key: string]: string | undefined
}

interface Member {
  name: string
  role: string
  linkedIn?: string
  focusAreas?: string[]
  industry?: string
}

function normalizeMember(m: RawMember): Member {
  const name = m["Full Name"] || m["Name"] || ""
  const role = m["Role"] || m["Job Title"] || ""
  const linkedIn = m["LinkedIn"] || undefined
  const focusAreasRaw = m["Focus Areas"] || ""
  const focusAreas = focusAreasRaw
    ? focusAreasRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined
  const industry = m["Industry"] || undefined

  return { name, role, linkedIn, focusAreas, industry }
}

async function fetchDirectory(): Promise<RawMember[]> {
  const res = await fetch("/api/members/directory")
  if (!res.ok) {
    throw new Error(`Failed to fetch directory: ${res.statusText}`)
  }
  return res.json()
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card/50 border-border/50 p-4 flex items-start gap-4">
      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-1 pt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function Directory() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")

  const { data: rawMembers, isLoading, isError } = useQuery<RawMember[]>({
    queryKey: ["directory"],
    queryFn: fetchDirectory,
  })

  const members = useMemo<Member[]>(() => {
    if (!rawMembers) return []
    return rawMembers.map(normalizeMember).filter((m) => m.name)
  }, [rawMembers])

  const uniqueRoles = useMemo(() => {
    const roles = new Set(members.map((m) => m.role).filter(Boolean))
    return Array.from(roles).sort()
  }, [members])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter((m) => {
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        (m.industry?.toLowerCase().includes(q) ?? false)
      const matchesRole = roleFilter === "all" || m.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [members, search, roleFilter])

  return (
    <div>
      <h1 className="text-3xl font-bold font-display mb-4">Member Directory</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, role, or industry…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {uniqueRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          Failed to load member directory. Please try again later.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {filtered.length} member{filtered.length !== 1 ? "s" : ""}
          </p>

          {filtered.length === 0 ? (
            <div className="flex justify-center items-center py-20 text-muted-foreground">
              No members match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((member, i) => (
                <MemberCard
                  key={`${member.name}-${i}`}
                  name={member.name}
                  role={member.role}
                  focusAreas={member.focusAreas}
                  linkedIn={member.linkedIn}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

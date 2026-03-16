import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, X } from "lucide-react"
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
  currentOrg?: string
  sector?: string
  location?: string
  email?: string
  phone?: string
  focusAreas?: string[]
  areasOfInterest?: string[]
  bio?: string
  skills?: string[]
  gravatarUrl?: string
  photoUrl?: string
  memberSince?: string
}

function normalizeMember(m: RawMember): Member {
  // Sheet1 column names (primary source)
  const name = m["Full Name"] || m["Name"] || ""
  const rawFocusAreas = m["Primary Product Focus Areas"]
  const rawInterests = m["Areas of Interest"]
  const rawSkills = m["Skills"]

  return {
    name,
    role: m["Job Role"] || m["Role"] || "",
    linkedIn: m["LinkedIn Profile"] || m["LinkedIn"] || undefined,
    currentOrg: m["Current or most recent employer"] || m["Current Org"] || undefined,
    sector: m["Industry"] || m["Sector"] || undefined,
    location: m["Location"] || undefined,
    email: m["Email"] || undefined,
    phone: m["Phone number"] || m["Phone"] || undefined,
    focusAreas: rawFocusAreas
      ? rawFocusAreas.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    areasOfInterest: rawInterests
      ? rawInterests.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    bio: m["Bio"] || undefined,
    skills: rawSkills
      ? rawSkills.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined,
    gravatarUrl: m["gravatarUrl"] || undefined,
    photoUrl: m["photoUrl"] || undefined,
    memberSince: m["Date"] || m["Member Since"] || undefined,
  }
}

async function fetchDirectory(): Promise<RawMember[]> {
  const res = await fetch("/api/members/directory", { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch directory: ${res.statusText}`)
  const data = await res.json()
  return data.members ?? data
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
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)

  const { data: rawMembers, isLoading, isError } = useQuery<RawMember[]>({
    queryKey: ["directory"],
    queryFn: fetchDirectory,
  })

  const members = useMemo<Member[]>(() => {
    if (!rawMembers) return []
    return rawMembers
      .map(normalizeMember)
      .filter((m) => m.name)
      .sort((a, b) => a.name.localeCompare(b.name))
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
        (m.currentOrg?.toLowerCase().includes(q) ?? false) ||
        (m.sector?.toLowerCase().includes(q) ?? false) ||
        (m.location?.toLowerCase().includes(q) ?? false) ||
        (m.email?.toLowerCase().includes(q) ?? false) ||
        (m.bio?.toLowerCase().includes(q) ?? false) ||
        (m.skills?.some((s) => s.toLowerCase().includes(q)) ?? false) ||
        (m.focusAreas?.some((a) => a.toLowerCase().includes(q)) ?? false) ||
        (m.areasOfInterest?.some((a) => a.toLowerCase().includes(q)) ?? false)
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
            placeholder="Search by name, role, organisation, sector, skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
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
            {search || roleFilter !== "all"
              ? `Showing ${filtered.length} of ${members.length} members`
              : `${filtered.length} member${filtered.length !== 1 ? "s" : ""}`}
          </p>

          {filtered.length === 0 ? (
            <div className="flex justify-center items-center py-20 text-muted-foreground">
              No members match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((member, i) => {
                const memberId = `${member.name}-${i}`
                return (
                  <MemberCard
                    key={memberId}
                    name={member.name}
                    role={member.role}
                    currentOrg={member.currentOrg}
                    sector={member.sector}
                    focusAreas={member.focusAreas}
                    linkedIn={member.linkedIn}
                    email={member.email}
                    phone={member.phone}
                    bio={member.bio}
                    skills={member.skills}
                    areasOfInterest={member.areasOfInterest}
                    location={member.location}
                    gravatarUrl={member.gravatarUrl}
                    photoUrl={member.photoUrl}
                    memberSince={member.memberSince}
                    expanded={expandedMemberId === memberId}
                    onToggle={() => setExpandedMemberId(expandedMemberId === memberId ? null : memberId)}
                  />
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

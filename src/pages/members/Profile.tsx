import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Profile {
  email: string
  name: string
  role: string
  current_org: string
  sector: string
  location: string
  focus_areas: string
  areas_of_interest: string
  linkedin_url: string
  bio: string | null
  skills: string
  enrichment_source: string
  profile_enriched: boolean
}

async function fetchProfile(): Promise<Profile> {
  const res = await fetch("/api/members/profile", { credentials: "include" })
  if (!res.ok) throw new Error("Failed to load profile")
  return res.json()
}

async function updateProfile(data: Partial<Profile>): Promise<Profile> {
  const res = await fetch("/api/members/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to save profile")
  return res.json()
}

async function enrichProfile(): Promise<Profile> {
  const res = await fetch("/api/members/profile/enrich", {
    method: "POST",
    credentials: "include",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "Enrichment failed")
  }
  return res.json()
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

export default function Profile() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading, isError } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  })

  const [form, setForm] = useState<Partial<Profile>>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        role: profile.role,
        current_org: profile.current_org,
        sector: profile.sector,
        location: profile.location,
        focus_areas: profile.focus_areas,
        areas_of_interest: profile.areas_of_interest,
        linkedin_url: profile.linkedin_url,
        bio: profile.bio ?? "",
        skills: profile.skills,
      })
      setDirty(false)
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data)
      setDirty(false)
      toast.success("Profile saved")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const enrichMutation = useMutation({
    mutationFn: enrichProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data)
      // Update form with enriched bio/skills without discarding other unsaved edits
      setForm((prev) => ({
        ...prev,
        bio: data.bio ?? "",
        skills: data.skills,
      }))
      setDirty(false)
      toast.success("Profile enriched from LinkedIn")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function onChange(field: keyof Profile, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  if (isLoading) return <ProfileSkeleton />

  if (isError) {
    return (
      <div className="flex justify-center items-center py-20 text-muted-foreground">
        Failed to load profile. Please try again later.
      </div>
    )
  }

  const showEnrichmentBanner =
    profile && !profile.profile_enriched && profile.linkedin_url

  return (
    <div>
      <h1 className="text-3xl font-bold font-display mb-6">Your Profile</h1>

      {showEnrichmentBanner && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Enrich your profile from LinkedIn</p>
              <p className="text-xs text-muted-foreground mt-1">
                We'll use AI to generate a professional bio and extract your skills from your LinkedIn profile.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
            >
              {enrichMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enriching…
                </>
              ) : (
                "Enrich Profile"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave}>
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={form.name ?? ""}
                  onChange={(e) => onChange("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={form.role ?? ""}
                  onChange={(e) => onChange("role", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_org">Organisation</Label>
                <Input
                  id="current_org"
                  value={form.current_org ?? ""}
                  onChange={(e) => onChange("current_org", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  value={form.sector ?? ""}
                  onChange={(e) => onChange("sector", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location ?? ""}
                  onChange={(e) => onChange("location", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                <Input
                  id="linkedin_url"
                  type="url"
                  value={form.linkedin_url ?? ""}
                  onChange={(e) => onChange("linkedin_url", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="focus_areas">Focus Areas</Label>
              <Input
                id="focus_areas"
                value={form.focus_areas ?? ""}
                onChange={(e) => onChange("focus_areas", e.target.value)}
                placeholder="Comma-separated, e.g. Product Strategy, AI, Growth"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="areas_of_interest">Areas of Interest</Label>
              <Input
                id="areas_of_interest"
                value={form.areas_of_interest ?? ""}
                onChange={(e) => onChange("areas_of_interest", e.target.value)}
                placeholder="Comma-separated, e.g. Leadership, Scaling, Community"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">Skills</Label>
              <Input
                id="skills"
                value={form.skills ?? ""}
                onChange={(e) => onChange("skills", e.target.value)}
                placeholder="Comma-separated, e.g. Roadmapping, User Research, Data Analysis"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={5}
                value={form.bio ?? ""}
                onChange={(e) => onChange("bio", e.target.value)}
                placeholder="Tell the community about yourself…"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end mt-4">
          <Button type="submit" disabled={!dirty || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

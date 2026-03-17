import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Save, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MemberAvatar } from "@/components/members/directory/MemberAvatar"

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
  phone: string
  photo_url: string
  show_email: boolean
  show_phone: boolean
  updated_at: string | null
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
        phone: profile.phone,
        show_email: profile.show_email,
        show_phone: profile.show_phone,
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

  function onChange(field: keyof Profile, value: string | boolean) {
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

  return (
    <div>
      <h1 className="text-3xl font-bold font-display mb-6">Your Profile</h1>

      <form onSubmit={handleSave}>
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="flex flex-row items-center gap-4">
            {profile && (
              <MemberAvatar
                name={profile.name}
                photoUrl={profile.photo_url || undefined}
                size={64}
              />
            )}
            <div>
              <CardTitle className="text-lg">Personal Information</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{profile?.email}</p>
              <a
                href="https://gravatar.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
              >
                Want a photo? Set up a free Gravatar
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
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
                placeholder="Tell the community about yourself..."
              />
            </div>

            <div className="border-t border-border/50 pt-4">
              <h3 className="text-sm font-medium mb-3">Contact Info</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email_display">Email</Label>
                  <Input
                    id="email_display"
                    value={profile?.email ?? ""}
                    disabled
                    className="bg-muted/50"
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.show_email ?? false}
                      onChange={(e) => onChange("show_email", e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-xs text-muted-foreground">Show on my directory card</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone ?? ""}
                    onChange={(e) => onChange("phone", e.target.value)}
                    placeholder="+44 7700 900000"
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.show_phone ?? false}
                      onChange={(e) => onChange("show_phone", e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-xs text-muted-foreground">Show on my directory card</span>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end mt-4">
          <Button type="submit" disabled={!dirty || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
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

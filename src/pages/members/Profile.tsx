import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Save, Loader2, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { MemberAvatar } from "@/components/members/directory/MemberAvatar"
import {
  fetchMemberProfile,
  MEMBER_PROFILE_QUERY_KEY,
  type MemberProfile as Profile,
} from "@/hooks/useMemberProfile"

async function resyncProfile(): Promise<Profile & { synced: number }> {
  const res = await fetch("/api/members/profile/resync", {
    method: "POST",
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to resync profile")
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
    queryKey: MEMBER_PROFILE_QUERY_KEY,
    queryFn: fetchMemberProfile,
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
        chat_identification_opted_out: profile.chat_identification_opted_out,
        chat_query_logging_opted_out: profile.chat_query_logging_opted_out,
      })
      setDirty(false)
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(MEMBER_PROFILE_QUERY_KEY, data)
      setDirty(false)
      toast.success("Profile saved")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resyncMutation = useMutation({
    mutationFn: resyncProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(MEMBER_PROFILE_QUERY_KEY, data)
      const n = data.synced
      if (n > 0) {
        toast.success(`Synced ${n} field${n !== 1 ? "s" : ""} from membership data`)
      } else {
        toast.info("Profile already up to date")
      }
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
                gravatarUrl={profile.gravatar_url || undefined}
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

            <div className="border-t border-border/50 pt-4 scroll-mt-20" id="chat-search-privacy">
              <h3 className="text-sm font-medium mb-3">Chat Search Privacy</h3>
              <p className="text-xs text-muted-foreground mb-4">
                These settings control how the "What's Everyone Talking About" chat-search feature handles your identity and your questions.
              </p>
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!(form.chat_identification_opted_out ?? false)}
                    onChange={(e) =>
                      onChange("chat_identification_opted_out", !e.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    data-testid="chat-identification-toggle"
                  />
                  <span>
                    <span className="text-sm font-medium">Show my name in chat search answers</span>
                    <span className="block text-xs text-muted-foreground">
                      When on, other members can see your name next to messages you wrote
                      in the chat search feature. When off, you appear as "A member".
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!(form.chat_query_logging_opted_out ?? false)}
                    onChange={(e) =>
                      onChange("chat_query_logging_opted_out", !e.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    data-testid="chat-query-logging-toggle"
                  />
                  <span>
                    <span className="text-sm font-medium">Log my questions to improve chat search</span>
                    <span className="block text-xs text-muted-foreground">
                      When on, we log the text of your questions to help us improve the
                      feature. When off, only question metadata (length, channel) is
                      logged — never the question text.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={resyncMutation.isPending}
            onClick={() => resyncMutation.mutate()}
          >
            {resyncMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Resync from membership data
              </>
            )}
          </Button>
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

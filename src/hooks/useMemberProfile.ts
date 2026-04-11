import { useQuery, type UseQueryResult } from '@tanstack/react-query'

export interface MemberProfile {
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
  gravatar_url: string
  show_email: boolean
  show_phone: boolean
  chat_identification_opted_out: boolean
  chat_query_logging_opted_out: boolean
  updated_at: string | null
}

export const MEMBER_PROFILE_QUERY_KEY = ['profile'] as const
const MEMBER_PROFILE_STALE_MS = 5 * 60 * 1000

export async function fetchMemberProfile(): Promise<MemberProfile> {
  const res = await fetch('/api/members/profile', { credentials: 'include' })
  if (!res.ok) throw new Error(`Failed to load profile (${res.status})`)
  return (await res.json()) as MemberProfile
}

export function useMemberProfile(): UseQueryResult<MemberProfile, Error> {
  return useQuery<MemberProfile, Error>({
    queryKey: MEMBER_PROFILE_QUERY_KEY,
    queryFn: fetchMemberProfile,
    staleTime: MEMBER_PROFILE_STALE_MS,
  })
}

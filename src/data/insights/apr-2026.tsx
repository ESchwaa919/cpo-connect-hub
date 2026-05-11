import { StatCard } from '@/components/members/insights/StatCard'
import { ChannelSection, type ChannelData } from '@/components/members/insights/ChannelSection'
import { useState } from 'react'
import { ChannelScopePicker } from '@/components/members/shared/ChannelScopePicker'
import type { ChannelScopeValue } from '@/lib/channel-scope-params'

// ── Aggregate stats ──────────────────────────────────────────────────────────

const aggregateStats = [
  { label: 'Total Messages', value: 689 },
  { label: 'Channels', value: 4 },
  { label: 'Active Days', value: 25 },
  { label: 'New Members', value: '—' },
  { label: 'Active Members', value: '118' },
]

// ── AI Channel ───────────────────────────────────────────────────────────────

const aiChannel: ChannelData = {
  name: 'AI',
  chartColor: '#7c3aed',
  sentimentColor: '#7c3aed',
  dailyVolume: [
    { day: '1', messages: 3 }, { day: '2', messages: 0 }, { day: '3', messages: 1 },
    { day: '4', messages: 0 }, { day: '5', messages: 0 }, { day: '6', messages: 0 },
    { day: '7', messages: 0 }, { day: '8', messages: 0 }, { day: '9', messages: 0 },
    { day: '10', messages: 28 }, { day: '11', messages: 1 }, { day: '12', messages: 9 },
    { day: '13', messages: 0 }, { day: '14', messages: 10 }, { day: '15', messages: 8 },
    { day: '16', messages: 1 }, { day: '17', messages: 34 }, { day: '18', messages: 11 },
    { day: '19', messages: 0 }, { day: '20', messages: 25 }, { day: '21', messages: 10 },
    { day: '22', messages: 13 }, { day: '23', messages: 1 }, { day: '24', messages: 57 },
    { day: '25', messages: 2 }, { day: '26', messages: 0 }, { day: '27', messages: 9 },
    { day: '28', messages: 16 }, { day: '29', messages: 9 }, { day: '30', messages: 18 },
  ],
  contributors: [
    { name: 'Caroline Clark', messages: 34, color: 'rgba(244,114,182,0.7)' },
    { name: 'Joana', messages: 33, color: 'rgba(251,191,36,0.7)' },
    { name: 'Erik Schwartz', messages: 29, color: 'rgba(167,139,250,0.7)' },
    { name: 'Graham Reed', messages: 22, color: 'rgba(52,211,153,0.7)' },
    { name: 'Sascha Brossmann', messages: 19, color: 'rgba(129,140,248,0.7)' },
    { name: 'Siddarth Shukla', messages: 12, color: 'rgba(96,165,250,0.7)' },
    { name: 'Harry Parkes', messages: 8, color: 'rgba(45,212,191,0.7)' },
    { name: 'Jason Knight', messages: 7, color: 'rgba(248,113,113,0.7)' },
    { name: 'Ashwin', messages: 7, color: 'rgba(251,146,60,0.7)' },
    { name: 'Alastair Preacher', messages: 5, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 90, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Skeptical', value: 30 },
    { label: 'Practical', value: 28 },
    { label: 'Philosophical', value: 18 },
    { label: 'Enthusiastic', value: 14 },
    { label: 'Humorous', value: 10 },
  ],
  trends: [
    {
      title: 'Anthropic Compute Crunch — Pro Plan “Barely Usable”',
      description:
        'On 24 Apr Caroline reported burning 90% of her Claude Pro session connecting up MCPs for the first time. The thread exploded — 57 messages in one day. Siddarth: “Pro is essentially pointless now. Barely usable.” Graham Reed laid out a survival kit (Max plan, Opus for building / Sonnet for operating, getting Claude to build Python scripts to compress repetitive routines). The community converged on the diagnosis: Anthropic is out of compute and throttling, and it will get worse before new data centres come online. Ashwin started asking the quiet C-suite question: “Anyone else pausing to think about companies putting all their eggs in the Claude basket?” J Rainey was already prototyping model-agnostic apps. Caroline shared the case of a Claude Team customer banned with no warning and no recourse — the source of real anxiety for solo founders and enterprise buyers alike.',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'Apr 24',
    },
    {
      title: 'Claude Platform & Claude Design Land on AWS',
      description:
        'On 30 Apr Erik Schwartz flagged the double announcement: OpenAI on AWS, and the full Claude Platform on AWS (not just the models). His read: “Customers like the ability to use AI-native workflows and security without all of the complexity that AWS introduces. Since IT organisations have already bought in on the administrative conveniences, procurement now becomes trivial.” Earlier in the month Ruan Odendaal showed Claude Design one-shotting a 1-pager, a website use case page, and LinkedIn images — hooking it up to OpenClaw to auto-produce assets after a feature ships. Harry Parkes confirmed Claude Design was “bloody good” while teasing getmeet.ai teams mode.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Apr 18–30',
    },
    {
      title: 'AKQA IRL — “AI in Product” Live Recap',
      description:
        'On 29 Apr CPO Connect hosted an IRL evening at AKQA on the impact of AI on the Product function. The next morning Erik Schwartz dropped a full long-form synthesis: AI is currently accelerating each stage of the existing workflow rather than transforming the operating model; PMs are moving closer to the act of building (prototypes, validation, evidence-led handoffs) while engineering must still be involved early; accountability stays where it was — customer value, commercial outcomes, prioritisation. Caroline: “Thanks for the amazing event — fantastic and thought provoking.” Ashwin: “Perfect LinkedIn antidote.”',
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'Apr 29–30',
    },
    {
      title: 'WisprFlow Slow Day & the Hunt for a Replacement',
      description:
        'On 20 Apr WisprFlow ground to a halt for several members. Alastair: “I will be at least 4567% less useful today.” Suvagata uninstalled (“heating up my phone with its CPU usage”) and switched to Superwhisper. Sascha tested FluidVoice: “clearly better than Superwhisper so far. Looks like it might get close to WisprFlow in both quality and UX.” Earlier in the month Sascha also flagged ghost-pepper (privacy-focused, on-device).',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Apr 20',
    },
    {
      title: 'Persona ID, LinkedIn & the Peter Thiel Question',
      description:
        'On 17 Apr Caroline kicked off a long thread on Persona — the ID-verification provider LinkedIn (and soon Claude) uses to verify users. Persona buries a clause in its ToS that allows training AI models on uploaded ID photos under GDPR “legitimate interest”, and is backed by Peter Thiel — the same company that leaked 70k IDs from Discord users. Joana: “There’s so much liability potential there that it’s hard to know where to start.” Caroline went further: “I’m wondering if I can create a pitch deck that’s basically ‘LinkedIn but built in Europe’.” Joana flagged a Stockholm/Germany venture already building it. The case for European tech sovereignty hardened.',
      tags: [{ label: 'Polarizing', variant: 'hot' }],
      dateRange: 'Apr 17',
    },
    {
      title: 'Substack Exit — Tate, Nazis, and Where to Move',
      description:
        'Caroline announced she’d skip a Substack publish day after a boycott over Andrew Tate being on the platform. Sascha sharpened it: “It’s not just Tate, this is endemic. Substack have been happy to amplify Nazi newsletters as long as they bring ROI for several years. I decided not to publish there for their fondness of monetising Nazis.” Alastair: “Beehiiv ftw.” Sascha also suggested Ghost as a use-case-dependent alternative. Erik: “It’s incredibly sad that an entire platform can be cancelled because of one bad actor — creates a real ethical dilemma.” Joana reframed: “It’s not about one actor. Tate is a symptom of a deeper chasm: freedom of speech vs managed discourse.”',
      tags: [{ label: 'Polarizing', variant: 'hot' }],
      dateRange: 'Apr 17–20',
    },
    {
      title: 'AMD’s Lobotomy Receipt — Claude Code’s March Decline',
      description:
        'Harry Parkes surfaced Stella Laurenzo’s GitHub issue (AMD’s director of AI): Claude Code reads code 3× less before editing, rewrites entire files 2× more often, and abandons tasks mid-way at rates previously zero. Across ~7,000 sessions she dated the behavioural collapse to Anthropic’s March 2026 thinking-content redaction — visible reasoning went from 100% to zero in eight days. AMD’s engineering team has already moved to a competing provider. Sascha: “There are various signals that the performance of all major models is significantly degrading after each new version launch. We get to see the full potential only when they have to show it off for marketing.”',
      tags: [{ label: 'Industry', variant: 'amber' }],
      dateRange: 'Apr 12',
    },
    {
      title: 'AI Brain Fry & the Cognitive Load of Agent Direction',
      description:
        'Erik Schwartz published his “10 Tips to Avoid AI Brain Fry” LinkedIn piece on 10 Apr. Harry Parkes: “Did you see Simon Willison on Lenny’s — burnt out by 11am? I 100% feel that days when hard at it. My rules on AI usage get overridden badly.” Threads continued into MCP-vs-CLI hygiene and Matt Stone’s “progressive disclosure” framing: don’t auto-connect MCPs, connect on demand. The undercurrent connected back to March’s Caroline / Dave Killeen “transitional work” thesis — AI is squeezing out the low-effort buffer tasks and leaving only high-cognitive-load work.',
      tags: [{ label: 'Personal', variant: 'amber' }],
      dateRange: 'Apr 10–24',
    },
    {
      title: 'Quality Engineering with Coding Agents',
      description:
        'Scott Weiss asked who was using AI for Quality Engineering coverage. Siddarth Shukla shared his recipe: overnight job finds commits below the coverage threshold, an agent writes the diff and sends for approval. “It works pretty good for unit tests. Not so good in end-to-end tests — just beware of test slop. You need to tighten the specifics and provide structure.” His standing prompt: focus on changed behaviour/regressions, prefer unit/integration over E2E, keep tests small and diff-aligned, assert observable outcomes not internals, don’t over-mock. First 1–2 weeks: review every diff, don’t auto-approve. He also recommended Graphify for local codebase graph context.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Apr 10–24',
    },
    {
      title: 'Lovable Security Crisis — The Other Shoe Drops',
      description:
        'Joana shared a TheNextWeb story on the Lovable vibe-coding security crisis. Jason Knight: “I wonder if Elena Verna is going to be able to paper over this.” Joana: “I don’t wish Elena any harm but they could use a CISO or two more than PLG right now.” Continues the March “Lovable is a giant lawsuit waiting to happen” thread from Joana — the prediction is now landing.',
      tags: [{ label: 'Industry', variant: 'hot' }],
      dateRange: 'Apr 22',
    },
    {
      title: 'Dave Killeen Ships 17k LoC in 2.5 Hours',
      description:
        'On 1 Apr Dave Killeen opened the month with a stat that set the tone: 17,000 lines of code written in a single overnight session, all tests passing, on a workflow combining his /agent-ready Claude Code skill (lengthens PRDs 7× with measurable outcomes) and a beads decomposition for chained tasks. “Would have taken a team of 5 about 5 weeks. Admittedly per a potentially biased AI — but the proxy for the delta is real. Very real.” Ran as an AMA in his LinkedIn thread.',
      tags: [{ label: 'Community Build', variant: 'green' }],
      dateRange: 'Apr 1',
    },
    {
      title: 'MemPalace, FluidVoice & the Open Source Drumbeat',
      description:
        'Erik dropped MemPalace (“co-created by Milla Jovovich”) on 10 Apr — a memory-as-rooms architecture for agents that drew mixed reviews but caught Dan Cohen’s eye for a project he was already prototyping. Sascha added two privacy-focused transcription contenders: ghost-pepper and FluidVoice. Jason Knight surfaced VoxCPM for local voice cloning. The pattern: members are quietly assembling open-source stacks for the bits the big providers either won’t do, or can’t do cheaply.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Apr 10–20',
    },
    {
      title: 'Welcoming James — The Claude Onboarding Pack',
      description:
        'New member James asked the simplest, best question: “does anyone have good documents / links / references for Claude setup to help me shortcut the obvious mistakes I’m going to make? CLAUDE.md do’s and don’ts, skills worth using, any power-user moves which would take me ages to figure out.” Erik: “It’s from January, so it’s a little bit dated (~3,264 features have shipped since this was posted) but it’s directionally correct,” then dropped @ClaudeDevs as the fire-hose. The reception captured the channel’s onboarding norm — generous, specific, and self-aware about how fast the ground is moving.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Apr 21',
    },
  ],
}

const aiStats = [
  { label: 'Messages', value: 266 },
  { label: 'Active Members', value: 62 },
  { label: 'Active Days', value: 20 },
  { label: 'New Members', value: '—' },
]

// ── General Channel ──────────────────────────────────────────────────────────

const generalChannel: ChannelData = {
  name: 'General',
  chartColor: '#60a5fa',
  sentimentColor: '#60a5fa',
  dailyVolume: [
    { day: '1', messages: 33 }, { day: '2', messages: 2 }, { day: '3', messages: 3 },
    { day: '9', messages: 2 }, { day: '10', messages: 2 }, { day: '12', messages: 1 },
    { day: '14', messages: 14 }, { day: '15', messages: 27 }, { day: '16', messages: 19 },
    { day: '17', messages: 26 }, { day: '19', messages: 1 }, { day: '20', messages: 10 },
    { day: '21', messages: 11 }, { day: '22', messages: 2 }, { day: '23', messages: 6 },
    { day: '24', messages: 9 }, { day: '27', messages: 31 }, { day: '28', messages: 24 },
    { day: '29', messages: 25 }, { day: '30', messages: 9 },
  ],
  contributors: [
    { name: 'Caroline Clark', messages: 24, color: 'rgba(244,114,182,0.7)' },
    { name: 'Tania', messages: 18, color: 'rgba(251,191,36,0.7)' },
    { name: 'Graham Reed', messages: 16, color: 'rgba(52,211,153,0.7)' },
    { name: 'Scotty', messages: 15, color: 'rgba(96,165,250,0.7)' },
    { name: 'James Engelbert', messages: 8, color: 'rgba(167,139,250,0.7)' },
    { name: 'Ahron', messages: 7, color: 'rgba(248,113,113,0.7)' },
    { name: 'Neil Pleasants', messages: 7, color: 'rgba(45,212,191,0.7)' },
    { name: 'Matt W', messages: 6, color: 'rgba(129,140,248,0.7)' },
    { name: 'Emily Tate', messages: 6, color: 'rgba(251,146,60,0.7)' },
    { name: 'Jason Knight', messages: 6, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 144, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 38 },
    { label: 'Humorous', value: 18 },
    { label: 'Enthusiastic', value: 16 },
    { label: 'Philosophical', value: 14 },
    { label: 'Skeptical', value: 14 },
  ],
  trends: [
    {
      title: 'Artemis II Launch — The Whole Channel Watches the Moon',
      description:
        '1 April opened with 33 messages in a single day, the highest of the month, as Caroline rallied the channel to watch Artemis II blast off — the first time humans have left low Earth orbit since the 1970s. Scotty live-texted from a delayed train at Richmond; Tania flagged the launch hold and restart in real time; Caroline narrated altitudes (“they’ve just passed where Katy Perry got to”); Ahron joked about the deceiving camera angles. The community at its best — product leaders, but also humans nerding out about humans heading back to the Moon.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Apr 1',
    },
    {
      title: 'The “Superstar” Salary Trap',
      description:
        'Damon shared an interesting late-stage compensation negotiation: clearer alignment with the hiring manager at £XXXk base didn’t carry through to offer, leading to multiple escalations and ultimately no deal. Jamie Webber: “‘For a superstar we will pay y.’ Often a few rounds later, that maximum is £130k when the candidate was looking for £200k.” Caroline: “‘We don’t think you’re a superstar, so we’re only going to pay you this.’” Tania nailed the absurdity: “I can almost hear this question in an interview — ‘So tell me, what makes you a superstar?’” Sharp consensus that transparent ranges + early talent-team conversations is the only practical fix. Hannah Day shared a discipline-of-the-band practice: cap hires at 60% of the band to leave runway for raises.',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Apr 14–16',
    },
    {
      title: 'KTLO, Tech Debt & the AI Speedup',
      description:
        'Matt W asked a simple question: what % of capacity is going to “keep the lights on”, and is AI changing it? 30+ replies. Toni: “More than 50% — spaghetti soup, hoping AI saves us all.” Parminder: 20% via a TechOps rota model. Graham’s “Tech20” (in theory 20%, reality differs). Ryan Musselwhite reported moving from 40–50% down to 15–20% over two years of dedicated work. Gary Jarvis nailed the AI angle: “It’s not so much reducing the % as changing what’s in it. The KTLO work doesn’t disappear but the cycle time on it drops massively.” Scotty’s line for the month: “You are here to make money, not software.” Sascha added: “What looks like tech debt on the surface is often rather org debt.”',
      tags: [{ label: 'Deep Dive', variant: 'hot' }],
      dateRange: 'Apr 27',
    },
    {
      title: 'CPO Connect Hub Launch & Community Bug-bash',
      description:
        'James Engelbert announced the first iteration of the members area on 16 Apr. Caroline: “GENIUS! Love the member directory, but what’s most valuable right now is the key trends and themes — if you’ve been on holiday for a week that is so helpful to catch up with rather than 100+ notifications!” Tania (always: “the first thing I always do… looking up my own profile”) opened a focused punch list — duplicate profile, broken LinkedIn URL, save-changes error toast. Siddarth Shukla flagged a security issue: “In the login flow, please do not tell if this user exists or not. The system is opening itself to a possible email scraping/validation.” Erik confirmed all feedback was taken on board. The dogfooding instinct of this group is one of its most valuable habits.',
      tags: [{ label: 'Community Build', variant: 'green' }],
      dateRange: 'Apr 16–28',
    },
    {
      title: 'The “We-Got-Bought” Popup Dilemma',
      description:
        'Neil Pleasants brought an exquisitely unfair real-world UX problem: the about-to-be-former owners of his company insist on a 40%-of-screen popup with an acknowledge CTA on the landing page of each new session for three months, announcing the PE acquisition. Craig Unsworth’s reframe was the line of the thread: “In a PE transaction, customer experience, brand messaging, and risk posture are squarely part of the value creation plan the incoming investor will want to shape themselves. Hard-coding a prominent persistent message before the deal closes cuts across that.” Graham: “Forget conversion and UX, this is company reputation territory.” Ben Andrews: “I’m imagining a non-digital version — every shopper stopped at the door with a takeover speech. What could possibly go wrong?”',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Apr 17',
    },
    {
      title: 'AKQA IRL — “Best Community I’ve Been Part Of”',
      description:
        'The CPO Connect IRL at AKQA on 29 Apr generated waves of unprompted gratitude. Nick Jemetta: “I’m a member of various communities and none come close to this one.” Caroline: “Three cheers for the CPO Connect founders for tonight’s event — blinking marvellous!” Lisa G shared photos; Tania, Doron, Suvagata, Esin all wrote in. The community-building investment is paying off in measurable energy.',
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'Apr 29',
    },
    {
      title: 'Female Product Lead × Kate Leto × Martin Eriksson',
      description:
        'Randy Silver and the Female Product Lead co-hosted Kate Leto and Martin Eriksson on 23 Apr on thriving as a leader when everything is being disrupted. Despite a tube strike, 40+ people turned up (Randy: “I thought we’d get 10”). Live-streamed; full recording on YouTube. Graham was gutted to miss it; Craig Unsworth’s team member returned a glowing review.',
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'Apr 23',
    },
    {
      title: 'Sales Dashboard Adoption — Carrots Beat Sticks',
      description:
        'Amit asked how to drive field-sales adoption of a customer dashboard built with rep feedback. Hannah Day: “It’s either stick or carrot. Carrot is always best.” Natalia got specific from sales-enablement experience: 20–30% of provided info actually gets used; champion-led, KPI-tied rollouts win; sales leaders being personally bought in is non-negotiable. James Venn shared the cautionary case: a Pendo dashboard that flopped because customers were already paid-up — the real need was a customer-health agent pulling Gong + Salesforce + Pendo signals. Caroline framed the diagnostic: “Were they asking for it? That should be an easier path than if it was someone else’s idea.” David Jarvis tossed in a Four Forces analysis link — the right tool for exactly this kind of “why isn’t this getting traction” puzzle.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Apr 15',
    },
    {
      title: 'Airfocus & the PM Tools Refrain',
      description:
        'Helen B asked about Airfocus as a roadmap/discovery tool. Craig Unsworth: “I know Airfocus very well — one of the best tools on the market. Even stronger for the Lucid connection now.” Aman had just recommended it after a full PM-tools review. Joana offered to intro Antonia Landi via Graham Reed. The annual “which PM tool now” undercurrent continues from March, with the answers fragmenting harder every month.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Apr 24',
    },
    {
      title: 'New Eyes — Debbie at UK Central Gov, Andrew’s Move',
      description:
        'Debbie Blanchard introduced herself as Head of Product for a UK central-government department: “looking forward to learning from peers and having a safe space to chat.” Andrew D announced his move from Eton Bridge to Dartmouth Partners, heading up digital & tech. Faith Forster shared a Product Circles London event (“25 people, no recordings, no pitching”). The channel’s recurring identity: not just a forum, but the network plumbing for senior PM mobility in the UK.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Apr 17–20',
    },
    {
      title: 'Happy Birthday, Jason Knight',
      description:
        'A small but unanimously joyful interlude on 28 Apr. Joana opened with the 👑, Doron and Emily Tate competed on best AI-generated-name-personalised birthday songs (Emily: “The options have expanded DRAMATICALLY in the last few months”). Jason: “Finally a killer use case!”',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Apr 28',
    },
  ],
}

const generalStats = [
  { label: 'Messages', value: 257 },
  { label: 'Active Members', value: 78 },
  { label: 'Active Days', value: 20 },
  { label: 'New Members', value: '—' },
]

// ── Jobs Channel (NEW) ───────────────────────────────────────────────────────

const jobsChannel: ChannelData = {
  name: 'Jobs',
  chartColor: '#f59e0b',
  sentimentColor: '#f59e0b',
  dailyVolume: [
    { day: '1', messages: 5 }, { day: '7', messages: 5 }, { day: '10', messages: 2 },
    { day: '12', messages: 1 }, { day: '13', messages: 3 }, { day: '14', messages: 3 },
    { day: '15', messages: 9 }, { day: '16', messages: 3 }, { day: '17', messages: 1 },
    { day: '19', messages: 6 }, { day: '20', messages: 2 }, { day: '21', messages: 10 },
    { day: '23', messages: 2 }, { day: '27', messages: 4 }, { day: '28', messages: 4 },
    { day: '29', messages: 21 },
  ],
  contributors: [
    { name: 'Tania', messages: 10, color: 'rgba(251,191,36,0.7)' },
    { name: 'Graham Reed', messages: 6, color: 'rgba(52,211,153,0.7)' },
    { name: 'Caroline Clark', messages: 4, color: 'rgba(244,114,182,0.7)' },
    { name: 'Sascha Brossmann', messages: 4, color: 'rgba(129,140,248,0.7)' },
    { name: 'Ben Andrews', messages: 4, color: 'rgba(167,139,250,0.7)' },
    { name: 'Joana', messages: 3, color: 'rgba(248,113,113,0.7)' },
    { name: 'Dan Cohen', messages: 2, color: 'rgba(96,165,250,0.7)' },
    { name: 'Scott Weiss', messages: 2, color: 'rgba(45,212,191,0.7)' },
    { name: 'Jessie', messages: 2, color: 'rgba(251,146,60,0.7)' },
    { name: 'Others', messages: 44, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 50 },
    { label: 'Polarizing', value: 20 },
    { label: 'Humorous', value: 12 },
    { label: 'Philosophical', value: 10 },
    { label: 'Enthusiastic', value: 8 },
  ],
  trends: [
    {
      title: 'Welcome to #Jobs — The Channel Goes Live',
      description:
        'April is the first full month of the dedicated Jobs channel. Jessie set the tone on 15 Apr with an intro to the new joiners and job seekers: “If you’re looking for new opportunities or curious about the market and need support, please feel free to DM me.” She named the community’s recruitment partner roster — Lauren and Tony from Pulse, Nick and Tony from Few & Far, Bryonny Barton from Zeren, Andrew Demetriou from Eton Bridge, Jamie Webber from RedCat. B (from Zeren Global) followed up with a personal intro. Joana and James Venn jumped in to DM. The channel’s posture from day one: warm, generous, no pitch theatre.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Apr 15',
    },
    {
      title: 'The Hybrid Working Brawl',
      description:
        'On 29 Apr Sascha Brossmann lit the channel up: “Why the fuck is next to every company out there so keen on operating in a hybrid setup? In most cases it boils down to getting the worst of both onsite and remote rather than the best.” Robin defended hybrid as a London commute compromise. Sascha: “I’ve yet to see a company that is able to demonstrate this mythical in-office collaboration and synergy for 3 days each week. The keyword is intentionality.” Mikkel: “Same sentence, just with less rage and no f-word.” Hannah Day shared the flex-the-days approach that’s working for her team; Graham Reed: “Treat our teams like adults, let them organise what this means — we often seem to think they’re not adults.” Nadia: hybrid only works in same-city teams; remote-first with quarterly IRL beats most hybrids. 21 messages on a single day, the channel’s biggest spike.',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Apr 29',
    },
    {
      title: 'Graham Builds an AI Product-Ops Role Finder',
      description:
        'On 15 Apr Graham Reed shared the agent he built to scour LinkedIn for actual Product Ops roles (cutting through the project-manager / programme-manager / product-manager / ops-manager noise) and deposit them in a free, open Airtable database, refreshed every morning. “It’s a little hit and miss on the searching — I’m still adding them manually too — but it works.” It also auto-matches against his jobseekers database. Caroline: “You’ve been busy Graham!” Graham: “Diving headfirst into AI this last quarter, yes.” The community’s pattern of “member solves their own pain, gives it away free” on full display.',
      tags: [{ label: 'Community Build', variant: 'green' }],
      dateRange: 'Apr 15',
    },
    {
      title: 'Sponsorship & The Shrinking London Bridge',
      description:
        'On 21 Apr Tania posted a Head of Product role at a LegalTech venture (multi-billion-dollar TAM, pre-seed closing, founder-level equity). Joana asked: “UK based, I assume?” When sponsorship turned out to be possible but London-only: “London is no longer a place for EU citizens, sadly. Thanks for checking though! It could have been a great match.” A quietly important pattern in the channel — great roles, structural friction, and a community honest about it.',
      tags: [{ label: 'Philosophical', variant: 'amber' }],
      dateRange: 'Apr 21',
    },
    {
      title: 'Role Mix — From Charity Trustee to Cyber Data Lead PM',
      description:
        'The month surfaced a wide spread of roles: Dan Cohen’s Product Operations Manager at Zen Educate (London hybrid); Tony Mulcock’s exclusive Product Director, Consumer Marketplace; Tania’s Associate Director Commercial at Fair4All Finance and Head of Propositions; a Staff PM in payments/fintech (also via Tania); Jessie’s £190k Senior Product Director MAT cover; Ben Andrews’ charity tech-trustee role at Learning With Parents; Lisa’s Head of Product, Manchester; J Rainey’s PE-backed B2C insurtech Head of Product in Cheshire (“the onsite requirement was too much for me, but hopefully not for one of you”); Yao Li’s Experian product marketing specialist; Lauren’s £90–100k Lead PM Cyber Data role at a household brand. The breadth is exactly what the channel was built for.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Apr 1–29',
    },
    {
      title: 'Applicant Tracking Systems — Know the Maze',
      description:
        'Sascha Brossmann shared a Huntr piece on how ATS systems actually work. Caroline: “Great article, thanks for sharing — off to update my job seekers course!” Quiet but useful — the channel’s practical undercurrent.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Apr 16',
    },
    {
      title: 'Recruiter Pitch Doping — “Battle Scars and Receipts”',
      description:
        'Foreshadowing the toxic-JD investigation that exploded in Leadership & Culture a day earlier, Gary Jarvis pasted an AI-generated CV summary spoofing the maximalist recruiter pitch language: “I fix it. The board gets a roadmap they can trust, the team stops dreading Mondays, and the products start making money. I’ve done that at $350M ARR, £90M ARR, and $400M ARR … without once needing to push anyone to ‘just before the breaking point’ because it turns out people deliver faster when they’re not bracing for impact.” A reminder that this community’s collective taste is sharper than any individual recruiter brief.',
      tags: [{ label: 'Humorous', variant: 'gold' }],
      dateRange: 'Apr 28',
    },
  ],
}

const jobsStats = [
  { label: 'Messages', value: 81 },
  { label: 'Active Members', value: 48 },
  { label: 'Active Days', value: 16 },
  { label: 'New Members', value: '—' },
]

// ── Leadership Channel ───────────────────────────────────────────────────────

const leadershipChannel: ChannelData = {
  name: 'Leadership & Culture',
  chartColor: '#34d399',
  sentimentColor: '#34d399',
  dailyVolume: [
    { day: '9', messages: 2 }, { day: '10', messages: 13 }, { day: '12', messages: 1 },
    { day: '17', messages: 1 }, { day: '20', messages: 1 }, { day: '21', messages: 1 },
    { day: '27', messages: 3 }, { day: '28', messages: 48 }, { day: '29', messages: 14 },
    { day: '30', messages: 1 },
  ],
  contributors: [
    { name: 'Sascha Brossmann', messages: 13, color: 'rgba(129,140,248,0.7)' },
    { name: 'Caroline Clark', messages: 12, color: 'rgba(244,114,182,0.7)' },
    { name: 'Gia', messages: 12, color: 'rgba(45,212,191,0.7)' },
    { name: 'James Engelbert', messages: 5, color: 'rgba(167,139,250,0.7)' },
    { name: 'Graham Reed', messages: 5, color: 'rgba(52,211,153,0.7)' },
    { name: 'Dan Cohen', messages: 4, color: 'rgba(96,165,250,0.7)' },
    { name: 'Gary Jarvis', messages: 3, color: 'rgba(251,146,60,0.7)' },
    { name: 'Esin', messages: 3, color: 'rgba(248,113,113,0.7)' },
    { name: 'Joana', messages: 3, color: 'rgba(251,191,36,0.7)' },
    { name: 'Michelle Wright', messages: 3, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 22, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Humorous', value: 28 },
    { label: 'Polarizing', value: 22 },
    { label: 'Practical', value: 22 },
    { label: 'Philosophical', value: 18 },
    { label: 'Personal', value: 10 },
  ],
  trends: [
    {
      title: 'The “Intensity in a Room” JD Investigation',
      description:
        'On 28 Apr Gia surfaced a Head of Product Delivery JD with requirements like “You bring intensity into a room” and “You’re not afraid to push people to just before the breaking point.” The channel’s collective immune system snapped on: 48 messages in one day, the highest of any L&C day this year. Gary Jarvis: “Woah… just imagine the leadership style of the hiring manager.” Chris: “This is always companies wanting people that are going to overwork themselves for the firm.” Caroline went full sleuth: “I just typed ‘head of product delivery’ in London and it was the first 3 results. Also — they’re at the cutting edge of technology, they have robots. (And that’s not just what they call their team!).” Sascha’s line of the month: “This job ad has ‘bro hustle culture exploiting insecure overachievers with the VCs breathing down the anxious founder’s necks’ stamped all over it in bright red bold uppercase.” Joana proposed casting Sascha as the candidate — “It could be the very first product-led sitcom.” Ahron: “Makes you realise how many red-flag companies we probably all have worked in / know but don’t have the means to share.”',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'Apr 28',
    },
    {
      title: 'The Problem with Workshops',
      description:
        'Caroline opened the month with an article on the limits of workshops as a delivery method for organisational change. Sascha sharpened it: “Workshops aren’t a problem as such, but relying on them as the primarily (if not singular) delivery method of org evolution is a recipe for failure.” His follow-up: “There’s nearly always the challenge of educating the client that change isn’t a project but a muscle to build and exercise continuously — without a clear destination. There’s a ton of extreme discomfort to sell in that respect.” Caroline closed: “It doesn’t help that budgets and planning cycles often force an arbitrary timeline for change to happen on. How we fund change is dissonant with how it actually happens.”',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'Apr 9–10',
    },
    {
      title: 'JPD vs Airtable vs “Build Your Own”',
      description:
        'On 29 Apr Jamie’s simple question — “Is anyone using Jira Product Discovery?” — unlocked a substantial product-tools thread. Hannah Day: JPD has good principles (the “car park” backlog, transparency) but living with three Jira variants is admin overhead hell. Dan Cohen broke the frame entirely: he scrapped Coda and Shortcut, built Mission Control in Lovable to support the Basecamp Shape Up model, and is now running the entire PDLC in it (reporting, staffing, roadmaps, board slides, weekly updates, voting backlog). “Save tens of thousands in license costs per year (hit this goal!).” Graham Reed and Matt W endorsed Airtable as the practical middle path. Michelle Wright shared a careful JPD experience. Caroline: “Crying for Trello (it’s what I use for everything).”',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Apr 29',
    },
    {
      title: 'Hire for Attitude, Train for Skills — Reframed for AI',
      description:
        'James Engelbert pulled on the Herb Kelleher / Southwest Airlines line: “I wonder, how much of skills and knowledge as we know it today will be disrupted by advancements in technology, and flip our thinking to be more like Herb?” A short thread — but the framing connects to the AI-skills-atrophy questions Caroline kept returning to all month.',
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'Apr 12',
    },
    {
      title: 'PM Competency Framework v2 — Updating for the AI Era',
      description:
        'On 30 Apr Caroline closed the month by pulling on a thread from the AKQA evening on how to stop skills from atrophying when using AI. She shared a v2 of her 8-competencies / 6-cognitive-skills framework, with strategic thinking and decision-making updated, and invited feedback on what’s missing. The bookend to a month where the leadership channel kept returning to the same uncomfortable question: as AI takes more cognitive load, which judgement muscles do we have to deliberately keep training?',
      tags: [{ label: 'Rising Trend', variant: 'amber' }],
      dateRange: 'Apr 30',
    },
  ],
}

const leadershipStats = [
  { label: 'Messages', value: 85 },
  { label: 'Active Members', value: 29 },
  { label: 'Active Days', value: 10 },
  { label: 'New Members', value: '—' },
]

// ── Channel stat grids ───────────────────────────────────────────────────────

function ChannelStats({
  stats,
}: {
  stats: { label: string; value: string | number }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
      {stats.map((s) => (
        <StatCard key={s.label} label={s.label} value={s.value} />
      ))}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function April2026() {
  const [scope, setScope] = useState<ChannelScopeValue>({
    mode: 'subset',
    ids: ['ai'],
  })
  const activeId = scope.mode === 'subset' ? scope.ids[0] : 'ai'

  return (
    <div className="space-y-8">
      {/* Aggregate stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {aggregateStats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="flex justify-end">
        <ChannelScopePicker
          value={scope}
          onChange={setScope}
          allowMultiSelect={false}
          showAllOption={false}
        />
      </div>

      {activeId === 'ai' && (
        <div className="mt-6">
          <ChannelStats stats={aiStats} />
          <ChannelSection data={aiChannel} />
        </div>
      )}

      {activeId === 'general' && (
        <div className="mt-6">
          <ChannelStats stats={generalStats} />
          <ChannelSection data={generalChannel} />
        </div>
      )}

      {activeId === 'jobs' && (
        <div className="mt-6">
          <ChannelStats stats={jobsStats} />
          <ChannelSection data={jobsChannel} />
        </div>
      )}

      {activeId === 'leadership_culture' && (
        <div className="mt-6">
          <ChannelStats stats={leadershipStats} />
          <ChannelSection data={leadershipChannel} />
        </div>
      )}
    </div>
  )
}

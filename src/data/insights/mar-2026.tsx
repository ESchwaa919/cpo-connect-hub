import { StatCard } from '@/components/members/insights/StatCard'
import { ChannelSection, type ChannelData } from '@/components/members/insights/ChannelSection'
import { useState } from 'react'
import { ChannelScopePicker } from '@/components/members/shared/ChannelScopePicker'
import type { ChannelScopeValue } from '@/lib/channel-scope-params'

// ── Aggregate stats ──────────────────────────────────────────────────────────

const aggregateStats = [
  { label: 'Total Messages', value: 702 },
  { label: 'Channels', value: 3 },
  { label: 'Active Days', value: 31 },
  { label: 'New Members', value: '\u2014' },
  { label: 'Active Members', value: '110+' },
]

// ── AI Channel ───────────────────────────────────────────────────────────────

const aiChannel: ChannelData = {
  name: 'AI',
  chartColor: '#7c3aed',
  sentimentColor: '#7c3aed',
  dailyVolume: [
    { day: '1', messages: 7 }, { day: '2', messages: 24 }, { day: '3', messages: 6 },
    { day: '4', messages: 18 }, { day: '5', messages: 9 }, { day: '6', messages: 15 },
    { day: '7', messages: 0 }, { day: '8', messages: 16 }, { day: '9', messages: 7 },
    { day: '10', messages: 21 }, { day: '11', messages: 40 }, { day: '12', messages: 33 },
    { day: '13', messages: 11 }, { day: '14', messages: 1 }, { day: '15', messages: 2 },
    { day: '16', messages: 20 }, { day: '17', messages: 3 }, { day: '18', messages: 0 },
    { day: '19', messages: 14 }, { day: '20', messages: 21 }, { day: '21', messages: 12 },
    { day: '22', messages: 14 }, { day: '23', messages: 8 }, { day: '24', messages: 5 },
    { day: '25', messages: 33 }, { day: '26', messages: 23 }, { day: '27', messages: 2 },
    { day: '28', messages: 1 }, { day: '29', messages: 9 }, { day: '30', messages: 1 },
    { day: '31', messages: 3 },
  ],
  contributors: [
    { name: 'Dave Killeen', messages: 44, color: 'rgba(248,113,113,0.7)' },
    { name: 'Harry Parkes', messages: 42, color: 'rgba(52,211,153,0.7)' },
    { name: 'Matt Stone', messages: 26, color: 'rgba(96,165,250,0.7)' },
    { name: 'Sascha Brossmann', messages: 25, color: 'rgba(129,140,248,0.7)' },
    { name: 'Erik Schwartz', messages: 25, color: 'rgba(167,139,250,0.7)' },
    { name: 'Joana', messages: 22, color: 'rgba(251,191,36,0.7)' },
    { name: 'Caroline Clark', messages: 16, color: 'rgba(244,114,182,0.7)' },
    { name: 'Member \u00b7\u00b7\u00b79211', messages: 16, color: 'rgba(45,212,191,0.7)' },
    { name: 'Ryan', messages: 13, color: 'rgba(251,146,60,0.7)' },
    { name: 'Jason Knight', messages: 13, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 137, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Enthusiastic', value: 20 },
    { label: 'Practical', value: 32 },
    { label: 'Skeptical', value: 25 },
    { label: 'Philosophical', value: 15 },
    { label: 'Humorous', value: 8 },
  ],
  trends: [
    {
      title: 'Claude Outage & the Burnout Hypothesis',
      description:
        'On 11 Mar Claude went down for hours mid-afternoon UK time and the channel exploded into a mix of panic, jokes (\u201chave a cup of tea\u201d, \u201cI\u2019m going out for some food\u201d), and a serious thread. Caroline Clark articulated the \u201ctransitional work\u201d theory: AI is squeezing out the low-effort, low-intensity tasks that used to act as a buffer between bursts of intense work, leaving only high-effort cognitive load and a recipe for burnout. Dave Killeen agreed that directing multiple agents is \u201chugely tiring and also fun but draining.\u201d The most resonant idea of the month.',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'Mar 11',
    },
    {
      title: 'Dex Goes Big \u2014 Apple Outreach & Community Schools',
      description:
        'Dave Killeen took a working week off to go \u201call Dex vibing\u201d after a senior contact at Apple running enterprise AI reached out for a meeting. Aakash dropped a video walkthrough, and Dave started planning a Dex release schedule with a Releases.md + SessionStart hook governance pattern. By month-end Dave was scoping an MTP-sponsored programme to bring Dex into schools, parents\u2019 groups, and Centrepoint outreach.',
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'Mar 11\u201326',
    },
    {
      title: 'Engineering Productivity, Measured',
      description:
        'Ryan shared real numbers from rolling out Codex/CodeRabbit across his ~30-developer team: a ~70% reduction in dev effort on certain tasks and a measurable drop in defects per release, with backing data on velocity and bug investigation time. Multi-day deep dive on how to actually measure efficiency, defects prevented, QA bottlenecks, and what 2-week sprints look like when output meaningfully accelerates. Harry and others pushed for Ryan to run a community walkthrough.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Mar 12\u201313',
    },
    {
      title: 'Wispr Flow Wins the Speech-to-Text Wars',
      description:
        'Harry kicked off a search for the best speech-to-text. After a flurry of opinions (Wispr, Superwhisper, Krisp.ai, voice notes \u2192 Gemini \u2192 Claude pipelines) the consensus crystallised around Wispr Flow, with caveats about US-hours slowdown and noisy environments. Dave Killeen flagged Superwhisper\u2019s mode prompts as a flexibility win. Multiple referral codes traded.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Mar 10\u201311',
    },
    {
      title: 'Delve, Cursor & the Trust Crash',
      description:
        'Two scandals hit in 24 hours. First, leaked screenshots suggested Cursor was running on Kimi (open-source) despite implying a proprietary model. Then a Substack expos\u00e9 on Delve \u2014 a Forbes 30-Under-30 \u201ccompliance\u201d startup \u2014 revealed an exposed Supabase, accessible Notion, and credible \u201cfake compliance as a service\u201d allegations. Joana: the Lovable ecosystem is \u201ca giant lawsuit waiting to happen.\u201d Sascha: \u201cSomething is rotten in the state of Denmark.\u201d',
      tags: [{ label: 'Polarizing', variant: 'hot' }],
      dateRange: 'Mar 20\u201321',
    },
    {
      title: 'Agentic Browser & CLI vs MCP Wars',
      description:
        'Erik Schwartz: \u201cWe are now entering the Agentic Browser wars.\u201d Triggered by Chrome 146\u2019s CLI release, then reinforced by Claude Code Channels launching mid-month. Dave Killeen published a newsletter arguing the WebMCP standard will be widely adopted because most browsers are Chromium-based. Max Mizzi shared a Scalekit article on MCP vs CLI \u2014 rough consensus: bright future for the CLI + skills model, content bloat is a real MCP problem.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Mar 16\u201320',
    },
    {
      title: 'Liability, Trust & the Real AI Moat',
      description:
        'Triggered by a member\u2019s Substack on B2B SaaS rethinking. Matt Stone: the differentiator is trust. Caroline highlighted the maintenance burden of self-built apps. Ahron raised the regulated-business angle \u2014 banks own AWS\u2019s problems in the eyes of regulators, so AI provider failures will land on the customer too. Sascha: prompt injection makes LLMs \u201cimpossible to protect\u201d until a new architecture supersedes transformers. Elena Cat\u00f3n referenced Harari\u2019s Davos question on AI legal personhood.',
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'Mar 22\u201323',
    },
    {
      title: 'Anthropic vs OpenAI \u2014 Velocity as Strategy',
      description:
        'Erik flagged the contrast: Anthropic shipping multiple features daily while OpenAI shut down Sora video and reorganised. Dispatch announcement got 24M views in 24 hours, 70M+ in a week. Caroline noted \u201cred flags\u201d in OpenAI\u2019s complex org structure (Fidji Simo / Kevin Weil split, Sam in founder mode). Ed and Dave Killeen pushed back: shipping fast isn\u2019t the same as shipping right \u2014 Dispatch felt half-baked, slow on enterprise rollouts, and several members couldn\u2019t even find features Anthropic announced.',
      tags: [{ label: 'Industry', variant: 'hot' }],
      dateRange: 'Mar 25',
    },
    {
      title: 'AI for Kids & Community Tech Service',
      description:
        'Jessie opened a thread about partnering with grass-roots charities to bring AI literacy to children without easy tech access. Quickly grew into a roster of routes: Raspberry Pi Foundation Code Clubs, Imagi, Oak National Academy, British Science Association, STEM Ambassadors. One member is doing primary-school Science Week sessions with a browser game his 8-year-old co-built (a llama catching bananas, in pyjamas, in the Bahamas). Dave Killeen offered to get MTP to sponsor the effort.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Mar 26',
    },
    {
      title: 'Layoffs, \u201cIntelligence Cost to Zero\u201d & the Job Market',
      description:
        'Atlassian announced ~1,600 layoffs. Harry: \u201cHeadcount theatre at the top, actual pain at the bottom.\u201d Dave Killeen hoped it would \u201cfree up amazing talent\u201d, prompting Jason Knight to ask sharply what \u201cintelligence cost to zero\u201d actually means \u2014 \u201clike, actually, without smirking.\u201d Max Mizzi gave a lengthy pushback: VC subsidies are masking the real unit economics, the cloud-compute analogy is being misused. Karpathy\u2019s job-impact analysis added fuel; Joana: Europe needs its own version.',
      tags: [{ label: 'Macro', variant: 'amber' }],
      dateRange: 'Mar 12\u201316',
    },
    {
      title: 'OpenClaw / Home AI Infrastructure',
      description:
        'Harry and Erik Schwartz compared OpenClaw setups. Harry put it on an old Lenovo Think Centre with 16GB RAM, currently driving with Sonnet 4.5 to keep token costs sane. Discussion of agentmail.to (giving the agent its own email), giving it a dedicated WhatsApp number, and an A2A async relay between OpenClaw and Claude. Prachi requested a community learning session. Multiple OpenClaw alternatives surfaced: Paperclip, Hermes Agent (Nous Research), IronClaw.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Mar 8\u201311',
    },
    {
      title: 'Harry Parkes Ships meet_',
      description:
        'Harry teased an agent-native scheduling tool, meet_, on 20 Mar with founder pricing for the first 50 sign-ups. Activated on 28 Mar (claim your name at getmeet.ai). On 30 Mar he shipped the \u201cintelligence layer\u201d with natural-language scheduling. Erik tested it on 31 Mar: \u201cThis is slick Harry. Well done.\u201d A clean example of a member shipping a real product live in front of the community over 11 days.',
      tags: [{ label: 'Community Build', variant: 'green' }],
      dateRange: 'Mar 20\u201331',
    },
  ],
}

const aiStats = [
  { label: 'Messages', value: 379 },
  { label: 'Active Members', value: 56 },
  { label: 'Active Days', value: 29 },
  { label: 'New Members', value: '\u2014' },
]

// ── General Channel ──────────────────────────────────────────────────────────

const generalChannel: ChannelData = {
  name: 'General',
  chartColor: '#60a5fa',
  sentimentColor: '#60a5fa',
  dailyVolume: [
    { day: '2', messages: 4 }, { day: '4', messages: 5 }, { day: '5', messages: 1 },
    { day: '12', messages: 1 }, { day: '13', messages: 6 }, { day: '14', messages: 24 },
    { day: '15', messages: 2 }, { day: '16', messages: 7 }, { day: '17', messages: 1 },
    { day: '18', messages: 52 }, { day: '19', messages: 22 }, { day: '20', messages: 33 },
    { day: '22', messages: 5 }, { day: '23', messages: 10 }, { day: '24', messages: 15 },
    { day: '25', messages: 4 }, { day: '27', messages: 6 }, { day: '31', messages: 4 },
  ],
  contributors: [
    { name: 'Sascha Brossmann', messages: 16, color: 'rgba(129,140,248,0.7)' },
    { name: 'Howard', messages: 14, color: 'rgba(96,165,250,0.7)' },
    { name: 'Robin', messages: 12, color: 'rgba(52,211,153,0.7)' },
    { name: 'Sarah Baker-White', messages: 10, color: 'rgba(45,212,191,0.7)' },
    { name: 'Member \u00b7\u00b7\u00b74106', messages: 10, color: 'rgba(251,146,60,0.7)' },
    { name: 'Caroline Clark', messages: 9, color: 'rgba(244,114,182,0.7)' },
    { name: 'Jason Knight', messages: 8, color: 'rgba(248,113,113,0.7)' },
    { name: 'Harry Parkes', messages: 6, color: 'rgba(167,139,250,0.7)' },
    { name: 'Joana', messages: 6, color: 'rgba(251,191,36,0.7)' },
    { name: 'Member \u00b7\u00b7\u00b71055', messages: 6, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 105, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 35 },
    { label: 'Enthusiastic', value: 10 },
    { label: 'Philosophical', value: 18 },
    { label: 'Skeptical', value: 15 },
    { label: 'Humorous', value: 22 },
  ],
  trends: [
    {
      title: 'The PM Tools Stack Debate',
      description:
        'Robin asked a simple question about the best PM software for strategic planning, OKRs, roadmapping, backlogs and customer insights \u2014 and lit a 50-message thread. Productboard, ProdPad, Aha!, Airfocus, Craft.io all surfaced. Then came the line of the month from another member: \u201cJira for work, PowerPoint for roadmaps. Undefeated combo.\u201d Ahron: \u201c\u2018PowerPoint for roadmaps\u2019 is the saddest statement ever.\u201d Howard quipped: \u201cYes, I lose sleep over them!\u201d Sascha argued for Miro + Notion over single-tool sprawl.',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Mar 18',
    },
    {
      title: 'Atomic Research & Knowledge Architecture',
      description:
        'Spinning out of the PM tools thread, Sascha turned the conversation into a deep cut on knowledge management: Tomer Sharon\u2019s Atomic Research, the Ladder of Inference (Argyris/Senge), and Andy Matuschak\u2019s public Zettelkasten. The thesis: \u201cThere is no clean workflow. It\u2019s always messy at some point. You only get to decide where the complexity and friction shall live in the system.\u201d',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Mar 18',
    },
    {
      title: 'TESCREAL \u2014 The 93% Awareness Gap',
      description:
        'Caroline Clark dropped a one-question poll: \u201cHave you ever heard of TESCREAL?\u201d Result: 41 of 44 votes were \u201cNo.\u201d Howard: \u201cYou need a fourth option: No, please write an article about it.\u201d A few days later Caroline did exactly that, publishing \u201cThe Seven Hidden Beliefs Driving Silicon Valley.\u201d Multiple members admitted alarm; Jessie announced she was \u201coff to the woods to cuddle a tree\u201d; Gregor recommended The Last Invention podcast for context.',
      tags: [{ label: 'Polarizing', variant: 'hot' }],
      dateRange: 'Mar 20\u201323',
    },
    {
      title: 'Signal Drift \u2014 Influence as a Neurodivergent Leader',
      description:
        'Dave (the 7479-suffix neurodivergent leadership coach) cross-posted his MindTheProduct article on \u201cSignal Drift\u201d \u2014 the slow erosion of strategic influence for leaders who think differently. Pana connected it to Barbara Minto\u2019s Pyramid Principle. Caroline raised the question of whether neurodivergent leaders should adopt rigid \u201cexecutive presence\u201d norms or push back. James Engelbert: \u201cThis is brilliant, I can finally name it!\u201d',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Mar 20\u201326',
    },
    {
      title: 'Six Nations Live \u2014 The Whole Group Watches Rugby',
      description:
        'Sarah Baker-White ran a poll on who would win the rugby on 14 March (winning option: \u201cThere\u2019s rugby?\u201d \u2014 tied with England). She then live-texted the entire match while ITVx crashed on a member\u2019s TV. \u201cBest match so far (even as an aussie).\u201d A reminder that this group is also a place to just hang out.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Mar 14',
    },
    {
      title: 'PRFAQ Templates & the Amazon Diaspora',
      description:
        'Prachi asked for a Claude-ready PRFAQ project template. Multiple Amazon alums offered help. Chanade volunteered to export hers from Confluence into a shared Google Doc for the community. A small but characteristic example of the channel\u2019s give-it-away culture.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Mar 19\u201320',
    },
    {
      title: 'MVP Definition Wars',
      description:
        'Triggered by a 0\u21921 product question. Howard pushed for \u201cMinimum Valuable Product\u201d; another member proposed \u201cMRP \u2014 Market Ready Product / Minimum Releasable Product\u201d; Sascha noted the original meaning was always \u201cMinimum Viable Prototype\u201d for value-prop validation. The annual MVP-naming relitigation, but with sharper edges thanks to AI making prototypes nearly free.',
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'Mar 18\u201319',
    },
    {
      title: 'ClickUp vs Jira & Reforge / Miro Consolidation',
      description:
        'Nick Whitford asked for a real opinion on ClickUp as a Jira/Confluence alternative; Gregor and a former Love Holidays migrator both endorsed it for OKR laddering and stakeholder accessibility. Separately, Reforge joined Miro \u2014 member commentary noted the parallel to Mind the Product joining Pendo. Speculation: ProductSchool may pivot from education to AI consulting; Hustle Badger ribbing duly ensued.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Mar 20, Mar 24',
    },
    {
      title: 'Hiring Threads & Network Help',
      description:
        'A steady stream of hiring asks throughout the month: an EasyJet contact request, a Head of User Research role re-advertised at a major brand, a 0.6 FTE Product Manager role at a national charity, an outsourced QA recommendation request (Zoonou/Qualitest surfaced), and a request to mentor a female head of data. Quieter than February\u2019s emotional hiring-crisis thread, but the network plumbing is steady.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Mar 4, 13, 19, 31',
    },
    {
      title: 'Proof-of-Work Challenge Resurfaces',
      description:
        'Joana revived an earlier thread on the \u201cProof of Work\u201d challenge: how do you find people you actually want on your team in a world flooded with AI-enhanced CVs? She started a separate WhatsApp group for anyone wanting to keep the thread going.',
      tags: [{ label: 'Emerging', variant: 'amber' }],
      dateRange: 'Mar 2',
    },
    {
      title: 'European SaaS Snapshot',
      description:
        'Arttu, a fractional CPO joining from Helsinki, shared a 12-month European SaaS market analysis: UK biggest, Italy fastest growing. Welcomed warmly. The community continues to widen geographically.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Mar 20',
    },
    {
      title: 'Damon\u2019s Claude-Built Pitch Deck',
      description:
        'A member asked what beats \u201cattach a slide deck\u201d for sharing pitches. Damon shared a Claude-built deck for an interview (with a remote-controlled mobile companion for advancing slides). Asked if the panel loved it: \u201cDifficult for them to say in an interview context but they clearly loved it.\u201d',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Mar 14',
    },
  ],
}

const generalStats = [
  { label: 'Messages', value: 202 },
  { label: 'Active Members', value: 57 },
  { label: 'Active Days', value: 18 },
  { label: 'New Members', value: '\u2014' },
]

// ── Leadership Channel ───────────────────────────────────────────────────────

const leadershipChannel: ChannelData = {
  name: 'Leadership & Culture',
  chartColor: '#34d399',
  sentimentColor: '#34d399',
  dailyVolume: [
    { day: '7', messages: 1 }, { day: '8', messages: 6 }, { day: '9', messages: 4 },
    { day: '10', messages: 15 }, { day: '12', messages: 1 }, { day: '13', messages: 60 },
    { day: '16', messages: 1 }, { day: '17', messages: 1 }, { day: '18', messages: 2 },
    { day: '19', messages: 1 }, { day: '20', messages: 12 }, { day: '21', messages: 3 },
    { day: '22', messages: 3 }, { day: '23', messages: 1 }, { day: '25', messages: 1 },
    { day: '26', messages: 7 }, { day: '30', messages: 1 }, { day: '31', messages: 1 },
  ],
  contributors: [
    { name: 'Caroline Clark', messages: 32, color: 'rgba(244,114,182,0.7)' },
    { name: 'James Engelbert', messages: 21, color: 'rgba(251,146,60,0.7)' },
    { name: 'Aaron', messages: 12, color: 'rgba(96,165,250,0.7)' },
    { name: 'Sascha Brossmann', messages: 8, color: 'rgba(129,140,248,0.7)' },
    { name: 'Ahron', messages: 7, color: 'rgba(167,139,250,0.7)' },
    { name: 'Joana', messages: 7, color: 'rgba(251,191,36,0.7)' },
    { name: 'Jessie', messages: 6, color: 'rgba(52,211,153,0.7)' },
    { name: 'Dave (Signal Drift)', messages: 4, color: 'rgba(45,212,191,0.7)' },
    { name: 'Others', messages: 24, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 25 },
    { label: 'Philosophical', value: 35 },
    { label: 'Enthusiastic', value: 12 },
    { label: 'Personal', value: 20 },
    { label: 'Skeptical', value: 8 },
  ],
  trends: [
    {
      title: 'Which Human Skills Atrophy First in the AI Era',
      description:
        'James Engelbert opened with the question: as AI takes more cognitive and admin load off people-leaders, which human skills atrophy fastest? Aaron\u2019s answer set the tone \u2014 sensemaking, judgement, and writing-as-thinking. Caroline Clark added comprehension: she \u201csometimes uses Claude to summarise academic papers and finds it gets the summary wrong.\u201d Quoting Thich Nhat Hanh: \u201cno mud, no lotus.\u201d Nick Whitford reverted to pen-and-paper for meeting notes: \u201cnot just feel more cognitively tuned, it *feels* good too.\u201d Sweden moving back to printed books cited as a leading indicator.',
      tags: [{ label: 'Most Active Thread', variant: 'hot' }],
      dateRange: 'Mar 8\u201310',
    },
    {
      title: 'Imposter Phenomenon in Product \u2014 the 96% Stat',
      description:
        'Caroline Clark shared her own research: 96% of product people surveyed reported imposter feelings. Triggered the longest thread of the month. Sascha added \u201cinsecure overachievers\u201d as an adjacent category and proposed co-creating a Wardley Mapping session on competence frameworks. The group converged on a few theories: product is a rapidly evolving field with no canonical educational path; impact is lagging and indirect; and product is constantly \u201ceducating\u201d orgs on its own value, which corrodes confidence.',
      tags: [{ label: 'Deep Dive', variant: 'hot' }],
      dateRange: 'Mar 12\u201313',
    },
    {
      title: 'Burnout \u2014 Sharing the Stories',
      description:
        'The imposter thread spilled into burnout. Caroline shared her 2023 burnout: cynicism was the first symptom \u2014 the catalyst for starting her own company. Ahron: \u201cyou have no idea you\u2019re burnt out till you\u2019re in it fully.\u201d Caroline closed: \u201cWhat can happen is we don\u2019t talk about them because of shame. I really appreciate people wading in on this.\u201d A standout moment of vulnerability and trust in the channel.',
      tags: [{ label: 'Personal', variant: 'amber' }],
      dateRange: 'Mar 13',
    },
    {
      title: 'PM \u2194 Engineering Friction at the C-suite Level',
      description:
        'Ahron\u2019s pet peeve: \u201ca PM writing a story asking for an API to be built.\u201d The conversation rose up the org chart \u2014 the CPO/CTO relationship usually mirrors PM/eng friction below. Aaron reframed SLT as \u201cSenior Leadership *Group*\u201d rather than Team. Discussion of CFO partnerships and how engineering background buys CTO trust but other C-suite peers take more time.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Mar 13',
    },
    {
      title: 'Outcomes vs Outputs & the \u201cOutcome Lifecycle\u201d',
      description:
        'Nick Whitford pushed back on Joana\u2019s \u201cnobody gets promoted for writing a great PRD\u201d line: if product owns outcomes, then it owns the \u201coutcome lifecycle\u201d \u2014 forecasted metric movements, observed movements, commercial impacts. The orgs love outputs because outputs are tangible; product\u2019s job is to make outcomes equally tangible.',
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'Mar 13',
    },
    {
      title: 'Signal Drift & Neurodivergent Leadership Influence',
      description:
        'Dave (the neurodivergent-leadership coach) shared his Signal Drift article in this channel too. Aktar: \u201cReally helpful to name and characterise the nuances of these conversations. Particularly pertinent in my situation right now.\u201d James Engelbert observed how naming a phenomenon precisely changes how the group processes it. Connected back to the imposter and skills-atrophy threads \u2014 same family of concerns, different angles.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Mar 18\u201326',
    },
    {
      title: 'AI & \u201cPerforming\u201d Competence',
      description:
        'Caroline shared a British Psychological Society piece on the difference between *being* competent and *performing* competence with AI. Jamie added that junior/mid practitioners using AI at every step before developing their own internal models is the real long-term risk. James: \u201cHow do leaders create space for these skills to stay sharp when the allure to just chuck into AI is so strong?\u201d The question landed without a clean answer \u2014 but a strong indicator of where the channel is heading next.',
      tags: [{ label: 'Rising Trend', variant: 'amber' }],
      dateRange: 'Mar 25\u201326',
    },
    {
      title: 'Confidential AI Adoption Sessions',
      description:
        'Caroline opened end-of-month bookings for confidential 30-minute sessions with senior product leaders \u2014 specifically on the gap between executive expectations of AI adoption and what\u2019s actually happening on the ground. Tally form shared as an alternative to live calls. A tangible follow-through on the month\u2019s recurring \u201cbelief and culture\u201d thread.',
      tags: [{ label: 'Community Initiative', variant: 'green' }],
      dateRange: 'Mar 30\u201331',
    },
  ],
}

const leadershipStats = [
  { label: 'Messages', value: 121 },
  { label: 'Active Members', value: 23 },
  { label: 'Active Days', value: 18 },
  { label: 'New Members', value: '\u2014' },
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

export default function March2026() {
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

      {activeId === 'leadership_culture' && (
        <div className="mt-6">
          <ChannelStats stats={leadershipStats} />
          <ChannelSection data={leadershipChannel} />
        </div>
      )}
    </div>
  )
}

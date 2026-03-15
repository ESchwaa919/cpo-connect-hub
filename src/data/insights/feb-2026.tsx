import { StatCard } from '@/components/members/insights/StatCard'
import { ChannelSection, type ChannelData } from '@/components/members/insights/ChannelSection'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// ── Aggregate stats ──────────────────────────────────────────────────────────

const aggregateStats = [
  { label: 'Total Messages', value: '1,483' },
  { label: 'Channels', value: 3 },
  { label: 'Active Days', value: 28 },
  { label: 'New Members', value: 45 },
  { label: 'Active Members', value: '130+' },
]

// ── AI Channel ───────────────────────────────────────────────────────────────

const aiChannel: ChannelData = {
  name: 'AI',
  chartColor: '#7c3aed',
  sentimentColor: '#7c3aed',
  dailyVolume: [
    { day: '1', messages: 10 }, { day: '2', messages: 27 }, { day: '3', messages: 7 },
    { day: '4', messages: 12 }, { day: '5', messages: 11 }, { day: '6', messages: 9 },
    { day: '7', messages: 129 }, { day: '8', messages: 8 }, { day: '9', messages: 11 },
    { day: '10', messages: 19 }, { day: '11', messages: 16 }, { day: '12', messages: 12 },
    { day: '13', messages: 68 }, { day: '14', messages: 40 }, { day: '15', messages: 1 },
    { day: '16', messages: 11 }, { day: '17', messages: 13 }, { day: '18', messages: 34 },
    { day: '19', messages: 20 }, { day: '20', messages: 12 }, { day: '21', messages: 42 },
    { day: '22', messages: 34 }, { day: '23', messages: 18 }, { day: '24', messages: 25 },
    { day: '25', messages: 37 }, { day: '26', messages: 66 }, { day: '27', messages: 66 },
    { day: '28', messages: 54 },
  ],
  contributors: [
    { name: 'Dave Killeen', messages: 184, color: 'rgba(248,113,113,0.7)' },
    { name: 'Jason Knight', messages: 88, color: 'rgba(251,146,60,0.7)' },
    { name: 'Erik Schwartz', messages: 52, color: 'rgba(167,139,250,0.7)' },
    { name: 'Harry Parkes', messages: 47, color: 'rgba(52,211,153,0.7)' },
    { name: 'Matt Stone', messages: 39, color: 'rgba(96,165,250,0.7)' },
    { name: 'Caroline Clark', messages: 39, color: 'rgba(244,114,182,0.7)' },
    { name: 'Alastair Preacher', messages: 36, color: 'rgba(251,191,36,0.7)' },
    { name: 'Sascha Brossmann', messages: 29, color: 'rgba(129,140,248,0.7)' },
    { name: 'Joana', messages: 27, color: 'rgba(45,212,191,0.7)' },
    { name: 'Graham Reed', messages: 17, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 254, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Enthusiastic', value: 35 },
    { label: 'Practical', value: 30 },
    { label: 'Skeptical', value: 15 },
    { label: 'Philosophical', value: 12 },
    { label: 'Humorous', value: 8 },
  ],
  trends: [
    {
      title: 'Claude Code Skills, Hooks & Workflow Automation',
      description:
        'Alastair Preacher shared frustrations with Claude skills failing on multi-step operations, proposing daisy-chained slash commands. Dave Killeen evangelized Claude Code Hooks as the deterministic solution, sharing his Dex project\'s hooks architecture. Harry Parkes and Graham Reed discussed building automations and MCP connections.',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Feb 7\u201313',
    },
    {
      title: 'AGI / ASI Debate \u2014 Hype vs. Reality',
      description:
        'Dave Killeen and Damon argued we are close to AGI. Jason Knight pushed back strongly, arguing LLMs are pattern matching. Sascha Brossmann provided deep philosophical critique dismantling both the "stochastic parrot" argument and uncritical AGI enthusiasm. Caroline Clark brought a psychological lens on the hype machine.',
      tags: [{ label: 'Polarizing', variant: 'hot' }],
      dateRange: 'Feb 7\u201322',
    },
    {
      title: 'AI Burnout & Work-Life Balance',
      description:
        'A TechCrunch article on burnout hitting AI early adopters sparked broad resonance. Matt Stone articulated the inversion where senior leaders become the bottleneck. Harry Parkes built "/balance" \u2014 a Claude-powered tool to enforce usage limits after his wife complained about his Claude obsession. Nick Whitford recommended "4000 Weeks."',
      tags: [{ label: 'Rising Trend', variant: 'hot' }],
      dateRange: 'Feb 10\u201328',
    },
    {
      title: 'Dex \u2014 AI Chief of Staff',
      description:
        'Dave Killeen introduced Dex, an open-source AI personal operating system built on Claude Code + Obsidian. His demo session attracted 39 attendees. Caroline Clark wrote a detailed "Getting Started with Dex" guide. Multiple members began adopting it.',
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'Feb 7\u201328',
    },
    {
      title: 'Opus 4.6 Launch & Vibe Coding',
      description:
        'Erik Schwartz flagged the Claude Opus 4.6 release. Mikkel Nielsen called it "absurdly good for frontend work." Dave Killeen built an iPhone and Apple Watch app in 37 minutes. The group compared Claude Code vs. Codex vs. Cursor vs. Lovable stacks.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Feb 4\u201320',
    },
    {
      title: 'Will AI Replace PMs / Software Engineers?',
      description:
        'Triggered by James Fitzgerald asking about PM automation and later by articles claiming software engineers would go extinct. Martin Rover-Parkes pushed back, calling it "role compression and skill redistribution, not extinction." Harry Parkes highlighted design roles being squeezed more than engineering.',
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'Feb 1\u20132, Feb 28',
    },
    {
      title: 'OpenClaw / Moltbot Security',
      description:
        'Erik Schwartz shared Karpathy\'s assessment. Siddarth Shukla ran security audits. A PCGamer story about OpenClaw deleting Meta\'s AI safety director\'s inbox raised alarm. Laurence Bahrami raised concerns about non-technical people installing harmful packages.',
      tags: [{ label: 'Cautionary', variant: 'amber' }],
      dateRange: 'Feb 1, Feb 5, Feb 24\u201325',
    },
    {
      title: 'Enterprise AI & GenAI Gateways',
      description:
        'Discussion of Microsoft Copilot adoption challenges, GenAI gateways at Booking.com (Doron), WPP Open (Jen Heape). Erik noted many orgs "tick a box" with Copilot rollouts without real impact, emphasizing mindset shift over technology shift.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Feb 2\u20134',
    },
    {
      title: 'Second Brain / PKM',
      description:
        'Laurence Bahrami\'s question catalyzed sharing of toolchains: Obsidian + Claude Code, Granola + Notion, Nimbalyst. A general trend emerged toward Obsidian for its local-first, markdown-native approach and better Claude Code integration.',
      tags: [{ label: 'Rising Trend', variant: 'green' }],
      dateRange: 'Feb 13\u201314, Feb 27',
    },
    {
      title: 'AI Hype Article Debates',
      description:
        'Matt Shumer\'s COVID-comparison AI-pace thread and David W. Silva\'s "I\'m Sorry to Burst Your Bubble" generated polarized reactions. Sascha wrote a lengthy philosophical dissection. Jason posted a detailed point-by-point review finding merit on both sides.',
      tags: [{ label: 'Polarizing', variant: 'hot' }],
      dateRange: 'Feb 11, Feb 21\u201322',
    },
    {
      title: 'ASIC-Based LLMs (Chat Jimmy / Taalas)',
      description:
        'Matt Stone introduced Chat Jimmy, a language model running on an ASIC chip instead of GPUs, noting incredible speed and implications for local inference. Jason investigated further, finding a $30M development effort behind it.',
      tags: [{ label: 'Emerging', variant: 'green' }],
      dateRange: 'Feb 26',
    },
    {
      title: 'OpenAI Social Graph & Ad Strategy',
      description:
        'J Rainey noticed OpenAI asking for contact sharing. Prasana analyzed their trajectory toward "Agentic Commerce." Sascha raised GDPR concerns. Harry Parkes questioned OpenAI\'s viability. Joana noted OpenAI\'s financials only work if every human alive becomes a paid subscriber.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Feb 16\u201317, Feb 23',
    },
    {
      title: 'Community Projects & PM Tools Survey',
      description:
        'Matt Stone vibe-coded a PM tools survey app in ~30 minutes, iterating features in real-time based on group feedback. Jason shared his Stakeholder Studio beta. Harry Parkes shared /promptly (reverse-engineers iterative prompts) and /balance (Claude usage limiter).',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Throughout Feb',
    },
  ],
}

const aiStats = [
  { label: 'Messages', value: 812 },
  { label: 'Active Members', value: 82 },
  { label: 'Active Days', value: 28 },
  { label: 'New Members', value: 19 },
]

// ── General Channel ──────────────────────────────────────────────────────────

const generalChannel: ChannelData = {
  name: 'General',
  chartColor: '#60a5fa',
  sentimentColor: '#60a5fa',
  dailyVolume: [
    { day: '2', messages: 7 }, { day: '3', messages: 28 }, { day: '5', messages: 13 },
    { day: '6', messages: 49 }, { day: '7', messages: 1 }, { day: '9', messages: 11 },
    { day: '10', messages: 28 }, { day: '11', messages: 41 }, { day: '12', messages: 27 },
    { day: '13', messages: 6 }, { day: '14', messages: 1 }, { day: '16', messages: 1 },
    { day: '17', messages: 72 }, { day: '18', messages: 29 }, { day: '19', messages: 23 },
    { day: '20', messages: 35 }, { day: '21', messages: 68 }, { day: '23', messages: 1 },
    { day: '24', messages: 45 }, { day: '25', messages: 25 }, { day: '26', messages: 8 },
    { day: '27', messages: 49 }, { day: '28', messages: 15 },
  ],
  contributors: [
    { name: 'Sascha Brossmann', messages: 71, color: 'rgba(129,140,248,0.7)' },
    { name: 'Jason Knight', messages: 47, color: 'rgba(251,146,60,0.7)' },
    { name: 'Scotty', messages: 43, color: 'rgba(248,113,113,0.7)' },
    { name: 'Joana', messages: 25, color: 'rgba(251,191,36,0.7)' },
    { name: 'Robin', messages: 21, color: 'rgba(52,211,153,0.7)' },
    { name: 'Caroline Clark', messages: 19, color: 'rgba(244,114,182,0.7)' },
    { name: 'Maria Chilikov', messages: 18, color: 'rgba(96,165,250,0.7)' },
    { name: 'Sarah Baker-White', messages: 16, color: 'rgba(45,212,191,0.7)' },
    { name: 'Tania', messages: 15, color: 'rgba(167,139,250,0.7)' },
    { name: 'James Engelbert', messages: 14, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 294, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 35 },
    { label: 'Enthusiastic', value: 20 },
    { label: 'Philosophical', value: 20 },
    { label: 'Skeptical', value: 15 },
    { label: 'Humorous', value: 10 },
  ],
  trends: [
    {
      title: 'Broken Hiring \u2014 CVs, ATS & the Recruitment Crisis',
      description:
        'A major multi-day thread on how hiring is fundamentally broken. Andy Freeburn shared a Lovable-built interactive CV; Maria Chilikov and Caroline Clark debated ATS formatting. Discussion expanded into ghost job posts (Joana tracking 50% unfilled roles), zero-risk hiring mentality, and LinkedIn applicant number inflation.',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Feb 17\u201319',
    },
    {
      title: 'Interview Horror Stories & Neuro-Inclusivity',
      description:
        "Carol's 7-interview process triggered a cascade of war stories: Sarah Baker-White (17 interviews), Neil Pleasants (11), Alistair Groves (7 ending when the company cancelled expansion). Jason Knight shared the story of an autistic friend who took his own life after repeated rejections, prompting important discussion about neuro-inclusivity in hiring.",
      tags: [{ label: 'Emotional', variant: 'hot' }],
      dateRange: 'Feb 21',
    },
    {
      title: 'Personal Productivity & Proving Value',
      description:
        'Robin asked about tracking and proving product work week-by-week. Sascha advocated Obsidian + backlinks + Kanban; Scotty recommended structured plans; James Engelbert shared the "5522" weekly report framework. Conversation evolved into how to demonstrate value in 0-to-1 product work.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Feb 6\u201310',
    },
    {
      title: 'Vibe Coding & the PM Role Debate',
      description:
        "Sascha shared Saeed Khan's article arguing vibe coding is not a PM superpower, sparking a late-night debate. Maria Chilikov pushed back, arguing early-stage companies need PM/eng/GTM hybrids. Sascha favored team-based divergent thinking; Maria favored velocity and decisiveness.",
      tags: [{ label: 'Polarizing', variant: 'hot' }],
      dateRange: 'Feb 24\u201325',
    },
    {
      title: 'Hardware vs. Software Product Management',
      description:
        'Alan Arnfeld posed whether hardware PM differs from software PM. Dan Cohen argued the role is fundamentally the same at the abstraction level. Helen B countered that software PMs underestimate hardware NFRs. Caroline Clark shared experience with rugged fingerprint scanners for humanitarian projects.',
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'Feb 20',
    },
    {
      title: 'ProductCon London',
      description:
        'The group collectively organized around ProductCon London on 24 Feb \u2014 Mikkel shared a 20% promo code, members offered work emails to help others register for free tickets, and Rebecca organized a meetup poll (20 voted yes). Strong community solidarity.',
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'Feb 9\u201324',
    },
    {
      title: '0-to-1 Product Work \u2014 Kill vs. Pivot',
      description:
        "Igor's poll about what hurts most in 0-to-1 work generated deep responses. Sascha emphasized holding space and not converging too early, noting 6-7 out of 10 initial options should blow up. Tom White highlighted founder emotional sunk equity.",
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'Feb 17',
    },
    {
      title: 'Capacity & Engineering Estimates',
      description:
        'Craig Unsworth\'s "Capacity is a Law of Physics, Not a Negotiation" sparked debate. Scotty pushed back with a story of engineers estimating 12 weeks but delivering in 6 through intense focus. Craig responded that burst sprints are doable but dangerous long-term.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Feb 12',
    },
    {
      title: 'Managing Product Copy & CMS',
      description:
        "Robin asked about managing versioned copy across in-app, push, SMS, and email. Jason recommended headless CMS (Contentful); Robin realized they already had Sanity but weren't using it. Multiple Figma-CMS plugins shared. Sascha warned about Airtable's temporary URLs.",
      tags: [{ label: 'Technical', variant: 'blue' }],
      dateRange: 'Feb 27\u201328',
    },
    {
      title: 'Private Equity & Due Diligence',
      description:
        "Alyx asked about PE experience. Craig works directly with PE funds. Joana's company was PE-acquired. David Magee shared PE-to-PE experience. Alyx proposed organizing a session on getting a business ready to be bought.",
      tags: [{ label: 'Rising Trend', variant: 'amber' }],
      dateRange: 'Feb 19',
    },
    {
      title: 'Local Meetups & Regional Community',
      description:
        'Community expanding beyond London. Scotty proposed a Richmond meetup; Jason suggested SE London; Tom White floated Birmingham/Oxford; Carla announced a new Liverpool tech meetup launching in April. The thread showed geographic diversification.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Feb 3\u20135, Feb 26\u201327',
    },
    {
      title: 'Frameworks Workshop & CPO Connect Events',
      description:
        'Free online "Frameworks, Judgment & Real-World Impact" session (19 Feb) featuring Alyx, Sascha, and Meg received strong feedback. CPO Connect Market Update (11 Feb) praised by multiple attendees. Rebecca and Alyx launched Product Economics workshop.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Feb 12\u201319',
    },
  ],
}

const generalStats = [
  { label: 'Messages', value: 583 },
  { label: 'Active Members', value: 107 },
  { label: 'Active Days', value: 23 },
  { label: 'New Members', value: 17 },
]

// ── Leadership Channel ───────────────────────────────────────────────────────

const leadershipChannel: ChannelData = {
  name: 'Leadership & Culture',
  chartColor: '#34d399',
  sentimentColor: '#34d399',
  dailyVolume: [
    { day: '1', messages: 9 }, { day: '2', messages: 5 }, { day: '3', messages: 7 },
    { day: '5', messages: 1 }, { day: '7', messages: 1 }, { day: '9', messages: 1 },
    { day: '10', messages: 1 }, { day: '11', messages: 2 }, { day: '12', messages: 2 },
    { day: '13', messages: 2 }, { day: '17', messages: 25 }, { day: '18', messages: 1 },
    { day: '19', messages: 28 }, { day: '23', messages: 1 }, { day: '25', messages: 1 },
    { day: '27', messages: 1 },
  ],
  contributors: [
    { name: 'James Engelbert', messages: 27, color: 'rgba(251,146,60,0.7)' },
    { name: 'Sascha Brossmann', messages: 23, color: 'rgba(129,140,248,0.7)' },
    { name: 'Alyx Priestley', messages: 5, color: 'rgba(248,113,113,0.7)' },
    { name: 'Caroline Clark', messages: 4, color: 'rgba(244,114,182,0.7)' },
    { name: 'Carla', messages: 4, color: 'rgba(52,211,153,0.7)' },
    { name: 'Meg Porter', messages: 3, color: 'rgba(96,165,250,0.7)' },
    { name: 'Gregor Young', messages: 2, color: 'rgba(251,191,36,0.7)' },
    { name: 'Others', messages: 20, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 40 },
    { label: 'Philosophical', value: 20 },
    { label: 'Enthusiastic', value: 20 },
    { label: 'Humorous', value: 10 },
    { label: 'Skeptical', value: 10 },
  ],
  trends: [
    {
      title: 'Interview Questions to Reveal True Culture',
      description:
        'James Engelbert asked about the smartest interview questions to uncover genuine growth mindset. Sascha recommended asking how decisions get made and about killed initiatives. Jamie shared 7 baseline culture due diligence questions. Jit warned about hiring managers who lie. Meg added questions about how often the org changes its model.',
      tags: [{ label: 'Most Active Thread', variant: 'hot' }],
      dateRange: 'Feb 17',
    },
    {
      title: 'Team Dysfunction & Micromanagement',
      description:
        "James described an adjacent team in turmoil where members complained about micromanagement but never to their manager. Sascha recommended removing the manager from retros and bringing in a neutral facilitator. Caroline challenged whether it was James's problem to solve. James proposed a three-step plan with team charters.",
      tags: [{ label: 'Deep Dive', variant: 'hot' }],
      dateRange: 'Feb 19',
    },
    {
      title: 'Board Experience & Non-Exec Roles',
      description:
        'Alyx Priestley asked for advice on positioning for board appointments. Sascha suggested building a community "board experience playbook." Gem added BCorp and EOS angles. Prasana proposed a dedicated "Board Talks" subgroup, which Gregor created.',
      tags: [{ label: 'Community Building', variant: 'green' }],
      dateRange: 'Feb 1\u20133',
    },
    {
      title: 'Changing Team Mindsets & Delivery Culture',
      description:
        'Carla shared challenges transforming a team conditioned to "plod along" where newly-introduced targets were perceived as pressure. She described bringing leads into commercial understanding and using Jira cycle time data to illustrate slow velocity. James probed her approaches.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Feb 3\u20139',
    },
    {
      title: 'M&A Experiences & Due Diligence',
      description:
        'Natalia Jaszczuk raised the desire for dedicated M&A discussion, highlighting both practical DD concerns and softer aspects (people, strategic alignment). Carla responded with detailed experience of executing an aggressive M&A strategy, calling the people/alignment side the hardest part.',
      tags: [{ label: 'Emerging', variant: 'amber' }],
      dateRange: 'Feb 3',
    },
    {
      title: 'Frameworks, Judgment & Real-World Impact',
      description:
        'Free online session on 19 Feb featuring Alyx, Sascha, and Meg focused on when frameworks help vs. create bureaucracy, building leadership judgment, and evolving organizational capabilities.',
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'Feb 12\u201319',
    },
  ],
}

const leadershipStats = [
  { label: 'Messages', value: 88 },
  { label: 'Active Members', value: 18 },
  { label: 'Active Days', value: 16 },
  { label: 'New Members', value: 9 },
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

export default function February2026() {
  return (
    <div className="space-y-8">
      {/* Aggregate stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {aggregateStats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      {/* Channel tabs */}
      <Tabs defaultValue="ai">
        <TabsList className="bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="ai">// AI (812)</TabsTrigger>
          <TabsTrigger value="general">// General (583)</TabsTrigger>
          <TabsTrigger value="leadership">// Leadership (88)</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-6">
          <ChannelStats stats={aiStats} />
          <ChannelSection data={aiChannel} />
        </TabsContent>

        <TabsContent value="general" className="mt-6">
          <ChannelStats stats={generalStats} />
          <ChannelSection data={generalChannel} />
        </TabsContent>

        <TabsContent value="leadership" className="mt-6">
          <ChannelStats stats={leadershipStats} />
          <ChannelSection data={leadershipChannel} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

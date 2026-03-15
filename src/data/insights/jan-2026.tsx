import { StatCard } from '@/components/members/insights/StatCard'
import { ChannelSection, type ChannelData } from '@/components/members/insights/ChannelSection'

// ── Stats ────────────────────────────────────────────────────────────────────

const stats = [
  { label: 'Messages', value: '~480' },
  { label: 'Active Members', value: '65+' },
  { label: 'Active Days', value: 22 },
  { label: 'New Members Joined', value: '25+' },
  { label: 'Key Topics', value: 12 },
]

// ── AI Channel ───────────────────────────────────────────────────────────────

const aiChannel: ChannelData = {
  name: 'AI',
  chartColor: '#7c3aed',
  sentimentColor: '#7c3aed',
  dailyVolume: [
    { day: 'Dec 29', messages: 2 }, { day: 'Dec 30', messages: 8 }, { day: 'Dec 31', messages: 5 },
    { day: 'Jan 5', messages: 52 }, { day: 'Jan 6', messages: 38 }, { day: 'Jan 7', messages: 30 },
    { day: 'Jan 8', messages: 14 }, { day: 'Jan 9', messages: 10 }, { day: 'Jan 10', messages: 1 },
    { day: 'Jan 11', messages: 3 }, { day: 'Jan 12', messages: 82 }, { day: 'Jan 13', messages: 32 },
    { day: 'Jan 14', messages: 16 }, { day: 'Jan 15', messages: 6 }, { day: 'Jan 16', messages: 6 },
    { day: 'Jan 17', messages: 5 }, { day: 'Jan 18', messages: 42 }, { day: 'Jan 20', messages: 2 },
    { day: 'Jan 21', messages: 6 }, { day: 'Jan 22', messages: 12 }, { day: 'Jan 23', messages: 0 },
    { day: 'Jan 24', messages: 8 }, { day: 'Jan 26', messages: 12 }, { day: 'Jan 27', messages: 8 },
    { day: 'Jan 28', messages: 22 }, { day: 'Jan 29', messages: 8 },
  ],
  contributors: [
    { name: 'Jason Knight', messages: 72, color: 'rgba(248,113,113,0.7)' },
    { name: 'Erik Schwartz', messages: 38, color: 'rgba(167,139,250,0.7)' },
    { name: 'Joana', messages: 42, color: 'rgba(251,191,36,0.7)' },
    { name: 'Caroline Clark', messages: 22, color: 'rgba(52,211,153,0.7)' },
    { name: 'Ryan Musselwhite', messages: 20, color: 'rgba(96,165,250,0.7)' },
    { name: 'Sascha Brossmann', messages: 20, color: 'rgba(251,146,60,0.7)' },
    { name: 'Damon', messages: 12, color: 'rgba(244,114,182,0.7)' },
    { name: 'Rafael (Raf)', messages: 12, color: 'rgba(129,140,248,0.7)' },
    { name: 'Natalia', messages: 10, color: 'rgba(45,212,191,0.7)' },
    { name: 'Others', messages: 230, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Enthusiastic', value: 25 },
    { label: 'Skeptical', value: 30 },
    { label: 'Practical', value: 25 },
    { label: 'Humorous', value: 10 },
    { label: 'Philosophical', value: 10 },
  ],
  trends: [
    {
      title: 'AI Coding Tool Wars',
      description:
        'Intense debate comparing Claude Code, Codex, Cursor, Lovable, Bolt, and Antigravity. Consensus: greenfield projects thrive with AI; legacy monoliths struggle. Engineering background still matters for security, DevOps, and scale. Erik upgraded to Claude Max and calls Opus "a powerhouse." Damon built a full CRM over Christmas with Claude + Supabase.',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Jan 5\u20136',
    },
    {
      title: 'AI Hype Backlash & Critical Thinking',
      description:
        'Strong pushback against AI hype. Caroline calls for originality over prediction. Dan warns LLMs are "mirrors \u2014 you only see yourself." Jason critiques auto-generated PRDs and calls out cherry-picked success stories. Joana highlights that influencers promoting AI tools often have financial incentives.',
      tags: [{ label: 'Rising Trend', variant: 'hot' }],
      dateRange: 'Jan 12\u201313',
    },
    {
      title: 'PRD Evolution & Documentation Philosophy',
      description:
        'Dan is on a mission to kill PRDs for anything not requiring an architect. Gia shares experiences with orgs spending months perfecting PRDs. Laurence highlights that team seniority and risk appetite drive documentation depth. Ruan shares Linear\'s PRD template and argues AI has dropped build effort so much that specs are "expensive procrastination."',
      tags: [{ label: 'Product Practice', variant: 'blue' }],
      dateRange: 'Jan 12\u201314',
    },
    {
      title: 'AI for Language Learning',
      description:
        "Multi-day thread on Duolingo's limitations sparked Jason to vibe-code LingoWeave in an afternoon. Natalia (ex-language learning industry) provides deep learning science context. Debunking of \"learning styles\" myth. Community organized a dedicated Zoom call on the topic.",
      tags: [{ label: 'Community Event', variant: 'green' }],
      dateRange: 'Jan 5\u201313',
    },
    {
      title: 'Personal AI Assistants & Security',
      description:
        'ClawdBot/MoltBot sparks excitement and concern. Mac Minis selling out as people build dedicated hardware. Simon tried it on EC2 and had a "security panic." Sascha warns the current attack surface growth is "breathtaking." Simon Willison\'s "lethal trifecta" article widely shared. Harry built his own personal AI chief of staff called "Antonson."',
      tags: [{ label: 'Emerging', variant: 'hot' }],
      dateRange: 'Jan 28\u201329',
    },
    {
      title: 'AI Market Dynamics & Positioning',
      description:
        "Gemini reaches 21% market share. Google's distribution is its moat. Claude has deeper enterprise/white-label penetration (Perplexity, etc.). Grok seen as niche \u2014 useful for unfiltered sentiment analysis. Meta acquires Manus for agentic infrastructure outside its ecosystem.",
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Dec 30 & Jan 7\u20138',
    },
    {
      title: 'Digital Twins & AI Ethics',
      description:
        "Delphi.ai's \"immortal\" product and MyPersonas.ai trigger deep debate about who owns your digital twin if your employer creates it. Caroline raises the staleness problem \u2014 twins lag behind real-time human learning. Concerns about trust erosion and removing human connection.",
      tags: [{ label: 'Philosophical', variant: 'blue' }],
      dateRange: 'Jan 17\u201318',
    },
    {
      title: 'Geopolitics Meets Tech Strategy',
      description:
        'Caroline frames US tech dependency as a product strategy concern. Alastair notes the UK lacks domestic payment rails. Discussion of swapping US tools for EU/UK alternatives. Technofeudalism book recommended by multiple members. Greenland tangent as lens into power dynamics.',
      tags: [{ label: 'Macro', variant: 'blue' }],
      dateRange: 'Jan 18',
    },
    {
      title: 'AI Engineering Efficiency Metrics',
      description:
        'Ryan rolling out Codex to 40+ dev team, targeting 5\u201310% efficiency gains initially. Max reports enterprise pilots landing at 20\u201330% improvement. Laurence pushes back on "10x" claims, citing research showing 20\u201360% gains mostly for junior devs on coding tasks. CodeRabbit vs Codex for code reviews compared.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jan 5 & Jan 8',
    },
    {
      title: 'Building AI Products (0 to 1)',
      description:
        "Mikkel shares detailed framework from building an AI companion in women's hormonal health: start with human discovery, test behaviour not answers, finetune only after repeated failures. Sascha adds evaluating probabilistic systems requires investing more in qual research and backend observability.",
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jan 26\u201327',
    },
    {
      title: 'AI Consulting Gold Rush',
      description:
        "Jason notes a well-regarded consultant pivoted entirely to AI consultancy because it's the only thing selling. Maven AI courses critiqued. Caroline leans into soft skills as a counter-bet. Everyone acknowledges the market is getting saturated with AI offerings.",
      tags: [{ label: 'Career', variant: 'blue' }],
      dateRange: 'Jan 13',
    },
    {
      title: 'Head of AI Role & Data Strategy',
      description:
        'Anuj and Prasana debate the Head of AI skillset. Key tension: academic/research background vs applied product delivery. Data strategy identified as critical and cross-functional (AI + Product + Engineering). Org AI maturity level determines boundaries.',
      tags: [{ label: 'Org Design', variant: 'blue' }],
      dateRange: 'Jan 22',
    },
  ],
}

// ── General Channel (Jan 2026) ───────────────────────────────────────────────

const generalChannel: ChannelData = {
  name: 'General',
  chartColor: '#f97316',
  sentimentColor: '#f97316',
  dailyVolume: [
    { day: 'Dec 29', messages: 2 }, { day: 'Dec 30', messages: 4 }, { day: 'Jan 2', messages: 5 },
    { day: 'Jan 3', messages: 8 }, { day: 'Jan 4', messages: 1 }, { day: 'Jan 6', messages: 4 },
    { day: 'Jan 7', messages: 28 }, { day: 'Jan 8', messages: 30 }, { day: 'Jan 9', messages: 8 },
    { day: 'Jan 11', messages: 3 }, { day: 'Jan 12', messages: 3 }, { day: 'Jan 13', messages: 35 },
    { day: 'Jan 14', messages: 32 }, { day: 'Jan 15', messages: 12 }, { day: 'Jan 16', messages: 22 },
    { day: 'Jan 19', messages: 2 }, { day: 'Jan 20', messages: 8 }, { day: 'Jan 21', messages: 45 },
    { day: 'Jan 22', messages: 72 }, { day: 'Jan 23', messages: 55 }, { day: 'Jan 24', messages: 4 },
    { day: 'Jan 27', messages: 8 }, { day: 'Jan 28', messages: 10 }, { day: 'Jan 29', messages: 40 },
  ],
  contributors: [
    { name: 'Jason Knight', messages: 38, color: 'rgba(248,113,113,0.7)' },
    { name: 'Sascha Brossmann', messages: 32, color: 'rgba(251,146,60,0.7)' },
    { name: 'Caroline Clark', messages: 35, color: 'rgba(52,211,153,0.7)' },
    { name: 'Jessie', messages: 28, color: 'rgba(250,204,21,0.7)' },
    { name: 'James Engelbert', messages: 25, color: 'rgba(96,165,250,0.7)' },
    { name: 'Nick Whitford', messages: 22, color: 'rgba(167,139,250,0.7)' },
    { name: 'Mikkel Nielsen', messages: 18, color: 'rgba(244,114,182,0.7)' },
    { name: 'Scotty', messages: 14, color: 'rgba(129,140,248,0.7)' },
    { name: 'Joana', messages: 12, color: 'rgba(45,212,191,0.7)' },
    { name: 'Ozgun Gulsal', messages: 14, color: 'rgba(253,186,116,0.7)' },
    { name: 'Others', messages: 310, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Supportive', value: 30 },
    { label: 'Frustrated', value: 15 },
    { label: 'Practical', value: 25 },
    { label: 'Celebratory', value: 20 },
    { label: 'Reflective', value: 10 },
  ],
  trends: [
    {
      title: 'CPO Connect IRL Launch Event',
      description:
        'The inaugural in-person event at Made by Many in London drew a packed house. Over 30 members posted glowing feedback calling it "psychologically safe," "the most open event," and "just the ticket to start the new year." Regional meetup groups spinning up. Next IRL event confirmed for March.',
      tags: [{ label: 'Biggest Moment', variant: 'hot' }],
      dateRange: 'Jan 22\u201323',
    },
    {
      title: 'Product Leader Retention Crisis',
      description:
        'Jessie sparked a major discussion on why product leaders (CPO/VP/Director) have just 1.5\u20132.5 year tenure. Michelle Wright delivered a standout post on the "first CPO" dual mandate: transformation vs delivery credibility. Ryan highlighted CTO/CPO clashes and authority gaps. Nick Whitford cited transformation failure rates of 75\u201388%.',
      tags: [{ label: 'Deep Thread', variant: 'hot' }],
      dateRange: 'Jan 21\u201322',
    },
    {
      title: 'Content & Publishing Platforms',
      description:
        'Substack vs Medium vs Beehiiv vs Ghost debated at length. Jason notes LinkedIn reach is cratering (30K followers, some posts shown to 200 people). Sascha refuses Substack on ethical grounds. Caroline warns you don\'t "own" your LinkedIn newsletter audience.',
      tags: [{ label: 'Creator Economy', variant: 'blue' }],
      dateRange: 'Jan 8',
    },
    {
      title: '"What Does a Product Manager Do?"',
      description:
        'Tom R asked how to explain PM in one sentence. Mikkel: "I\'m accountable for the product decisions that determine what we build, when we build it, and whether it creates real customer and business value." Scotty frames it around the problem solved. Sascha simplifies to "I maximise value."',
      tags: [{ label: 'Community Favourite', variant: 'gold' }],
      dateRange: 'Jan 23',
    },
    {
      title: 'Lead Without Authority \u2014 The Rant',
      description:
        'Alyx lights the fuse: "So much responsibility and you\'re expected to lead without authority. Give me a damn break." Aamna hates the "mini CEO" carrot. Martha raises the HIPPO problem. Mikkel offers the nuanced take: dysfunctional orgs use it as a cop-out, but influence-as-skill is genuinely rare and powerful.',
      tags: [{ label: 'Spicy', variant: 'hot' }],
      dateRange: 'Jan 14',
    },
    {
      title: 'Skills Mapping & Team Development',
      description:
        "Robin needs to map PM/dev/designer skills for coaching vs hiring decisions. Caroline shares a 3-bucket heuristic (human skills, technical skills, domain skills) plus the Dreyfus model. Sascha recommends anchoring to team capabilities, not individual roles. Lisa recommends Petra Wille's PM Wheel.",
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jan 16',
    },
    {
      title: 'Writing & Personal Branding',
      description:
        "Carla asks if building a profile through writing is worth it. Jason's honest take: it's oversaturated and filled with AI slop, but do it anyway because it sharpens thinking. Scott shares his decade-long journey from field notes to newsletter to published book.",
      tags: [{ label: 'Career', variant: 'blue' }],
      dateRange: 'Jan 13',
    },
    {
      title: 'Product Training Resources',
      description:
        'James Thornett asks for entry-level PM training options. Sascha advocates social, practice-integrated learning over content delivery. Recommendations: Mind the Product (free), Hustle Badger, Product School, FourthRev (6-month course), Matt Walton\'s cohort courses.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jan 7',
    },
    {
      title: 'Transformation & Organisational Change',
      description:
        'Spins out of the retention discussion. Caroline shares her Substack article on why transformations fail. Nick cites consulting research showing only 12\u201325% success rate. Sascha argues transformation is a team capability, not one person\'s job.',
      tags: [{ label: 'Leadership', variant: 'blue' }],
      dateRange: 'Jan 22',
    },
    {
      title: 'New AI Podcast Pitch',
      description:
        "Igor pitches a podcast focused on real AI implementation stories, not hype. First episode from eBay. Caroline challenges differentiation from Claire Vo's \"How I AI.\" Sascha wants more on governance and security.",
      tags: [{ label: 'Content', variant: 'blue' }],
      dateRange: 'Jan 14',
    },
    {
      title: 'Dev Agencies & Hiring',
      description:
        "Ankur's request for UK/Europe dev agencies (Go, React, Full Stack) triggered a wave of recommendations: Data Art, Vention, UIC Digital, Polish agencies, FX31 (India). Also accessibility audit agencies: Level Access, DIG Inclusion.",
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jan 23',
    },
    {
      title: 'The Avios Takeover',
      description:
        'Chanade from IAG Loyalty joins and triggers the most wholesome thread of the month. Business class to Australia on Avios points. BA Amex hacks. Story Points loyalty programme joke. Harry\'s travel hack: "don\'t have kids."',
      tags: [{ label: 'Community Joy', variant: 'gold' }],
      dateRange: 'Jan 29',
    },
  ],
}

const generalStats = [
  { label: 'Messages', value: '~550' },
  { label: 'Active Members', value: '80+' },
  { label: 'Active Days', value: 24 },
  { label: 'New Members Joined', value: '30+' },
  { label: 'Key Topics', value: 12 },
]

// ── Component ────────────────────────────────────────────────────────────────

export default function January2026() {
  return (
    <div className="space-y-8">
      {/* AI channel stats */}
      <div>
        <h3 className="text-lg font-semibold text-purple-300 mb-4">
          // AI Channel
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
          {stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
        <ChannelSection data={aiChannel} />
      </div>

      {/* General channel */}
      <div>
        <h3 className="text-lg font-semibold text-orange-400 mb-4">
          // General Channel
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
          {generalStats.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              gradient="from-orange-400 to-yellow-400"
            />
          ))}
        </div>
        <ChannelSection data={generalChannel} />
      </div>
    </div>
  )
}

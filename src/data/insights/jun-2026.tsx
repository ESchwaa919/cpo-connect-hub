import { StatCard } from '@/components/members/insights/StatCard'
import { ChannelSection, type ChannelData } from '@/components/members/insights/ChannelSection'
import { useState } from 'react'
import { ChannelScopePicker } from '@/components/members/shared/ChannelScopePicker'
import type { ChannelScopeValue } from '@/lib/channel-scope-params'

// ── Aggregate stats ──────────────────────────────────────────────────────────

const aggregateStats = [
  { label: 'Total Messages', value: 1067 },
  { label: 'Channels', value: 4 },
  { label: 'Active Days', value: 29 },
  { label: 'New Members', value: '—' },
  { label: 'Active Members', value: '126' },
]

// ── AI Channel ───────────────────────────────────────────────────────────────

const aiChannel: ChannelData = {
  name: 'AI',
  chartColor: '#7c3aed',
  sentimentColor: '#7c3aed',
  dailyVolume: [
    { day: '1', messages: 10 }, { day: '2', messages: 2 }, { day: '3', messages: 27 },
    { day: '4', messages: 15 }, { day: '5', messages: 41 }, { day: '6', messages: 1 },
    { day: '9', messages: 8 }, { day: '10', messages: 58 }, { day: '11', messages: 53 },
    { day: '12', messages: 11 }, { day: '13', messages: 25 }, { day: '14', messages: 2 },
    { day: '15', messages: 2 }, { day: '16', messages: 5 }, { day: '17', messages: 7 },
    { day: '18', messages: 6 }, { day: '19', messages: 27 }, { day: '20', messages: 1 },
    { day: '21', messages: 2 }, { day: '22', messages: 7 }, { day: '24', messages: 1 },
    { day: '25', messages: 34 }, { day: '26', messages: 48 }, { day: '27', messages: 3 },
    { day: '28', messages: 3 }, { day: '29', messages: 34 }, { day: '30', messages: 21 },
  ],
  contributors: [
    { name: 'Shannon', messages: 57, color: 'rgba(251,146,60,0.7)' },
    { name: 'Sascha Brossmann', messages: 48, color: 'rgba(167,139,250,0.7)' },
    { name: 'Dave Killeen', messages: 44, color: 'rgba(244,114,182,0.7)' },
    { name: 'Mikkel Nielsen', messages: 37, color: 'rgba(248,113,113,0.7)' },
    { name: 'Jason Knight', messages: 33, color: 'rgba(129,140,248,0.7)' },
    { name: 'Erik Schwartz', messages: 26, color: 'rgba(251,191,36,0.7)' },
    { name: 'Gordon', messages: 19, color: 'rgba(52,211,153,0.7)' },
    { name: 'Prasana', messages: 12, color: 'rgba(96,165,250,0.7)' },
    { name: 'Siddarth Shukla', messages: 11, color: 'rgba(45,212,191,0.7)' },
    { name: 'Maria Chilikov', messages: 11, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 156, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 30 },
    { label: 'Skeptical', value: 26 },
    { label: 'Enthusiastic', value: 18 },
    { label: 'Philosophical', value: 16 },
    { label: 'Humorous', value: 10 },
  ],
  trends: [
    {
      title: 'Fable 5 Lands — Then Vanishes',
      description:
        'The month’s defining arc. Ruan Odendaal opened it late on 9 June — “I’ve been playing with Fable 5 this evening, it’s nuts, absolutely nuts” — with the warning that it would leave the plans on 23 June and cost real money after. By the morning of the 10th Dave Killeen had been “up since 04:30 with Fable,” had it build a Granola-style clone with offline transcription (“no problem!”), and declared himself “genuinely floored.” David Magee: “Feels like the biggest shift since Nov ’25.” Then on 13 June it was pulled. Erik Schwartz: “The dream is over.” The channel turned detective: Simon Willison and CoderabbitAI writeups, Pliny-style jailbreak chatter, Georg Zoeller’s hypothesis that this was punitive pressure to enforce surveillance infrastructure, and Yatin’s Axios link pointing at Amazon. Mikkel Nielsen’s hindsight take: the largest Anthropic investor lobbied to pause it, “they’ll re-release it and it’ll fly off the shelves because it was thought too powerful to release.”',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'Jun 9–13',
    },
    {
      title: 'Dave Killeen’s 48-Hour Build Sprint — “Judgment Is the Scarce Resource Now”',
      description:
        'The single most-discussed post of the month. Dave pulled his open-source “chief of staff” Dex out of the terminal into a full native desktop app, an iPhone app, on-device meeting transcription, and a cloud deploy — in two days. The numbers he went back and verified: 135 Claude sessions plus 76 sub-agents, 1.41 billion tokens processed, 206 commits, roughly 78k lines across four codebases, 540+ tests green on the final run. “At API list prices that is about $1,900 of compute. What I actually paid: my flat monthly subscription. My side of the whole collaboration: about 430 plain-English messages. Not one line of code.” He ran it “like an org” — six agents in isolated branches, an orchestrator merging one lane at a time, overnight runs while he slept. The line that landed: “At no point in those 48 hours was engineering capacity the constraint. I was the constraint… Judgment is the scarce resource now.”',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'Jun 10–13',
    },
    {
      title: 'The Token-Economics Counter-Melody — Mikkel’s Unit-Cost Masterclass',
      description:
        'Against the Fable euphoria, Mikkel Nielsen ran the numbers. His key distinction: a frontier model in your coding assistant is a cheap multiplier on expensive engineer time; a frontier model in your production pipeline is cost of goods, called millions of times, landing straight on unit economics. Running ~1 billion tokens a month in production, he sits ~95% on open-weight Kimi K2.6 (blended under $1 per million with caching) — “The identical tokens on Opus would be $5–7k.” His frame for the whole debate: “Expensive frontier models belong in the toolchain, but rarely in the hot path.” And the reason prices can’t simply be raised — the open-weight floor: “You can’t price-match against free,” invoking the Windows/IIS-vs-Linux arc as the template for where the model layer is heading.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jun 5–19',
    },
    {
      title: 'Model as Commodity — Benedict Evans, Core vs Chore, and the IPO Question',
      description:
        'Early June set the strategic frame off the back of Benedict Evans on Lenny’s. Dan reframed the build-vs-buy question for the AI era: “core you build, because it’s your edge and you want to own it; chore you buy, because you don’t want the liability” — with cheap build now pulling things both ways. Sascha Brossmann: “The LLM is a commodity and can rather easily be switched… Anyone who depends operationally on cutting-edge frontier tech is in an extremely vulnerable spot.” The undercurrent all month: model makers facing permanent margin pressure, Chinese open-weights setting the ceiling, and IPOs read less as capital-raising than as “bailing out investors before the narrative folds.”',
      tags: [{ label: 'Industry', variant: 'amber' }],
      dateRange: 'Jun 3–5',
    },
    {
      title: 'SpaceX Buys Cursor for $60bn — “Crossed the Border to Insanity”',
      description:
        'On 16 June the acquisition news dropped and the channel’s strategists were unsparing. Sascha Brossmann: “Offering $60bn for a VSCode fork with an agent harness, some user data and a slightly fine-tuned open-weights coding model has successfully crossed the border to insanity several times in a row.” Mikkel Nielsen picked apart the logic — Claude Code runs independently of Cursor, so there’s little defensible market-share capture — landing on “xAI desperately trying to catch up and a very frothy SpaceX IPO valuation,” an all-stock deal that “cost them nothing and helped pump the valuation.” He also flagged the S-1’s eye-watering “$28.5 trillion TAM,” prompting Sascha’s napkin math against global GDP.',
      tags: [{ label: 'Polarizing', variant: 'amber' }],
      dateRange: 'Jun 16–18',
    },
    {
      title: 'Skills as Strategy — “Your First AI Strategy Should Be a Collection of Skills”',
      description:
        'A quieter but high-conviction thread. Erik Schwartz shared Hiten Shah’s argument that a company’s first AI strategy should be a collection of skills; Prasana connected it to Tessl’s tightly-coupled skills-and-tasks approach and the emerging skills marketplaces (SkillsMP cataloguing over 1.6 million indexed skills across occupation groups). The bet the room kept returning to: models commoditise, but the skills-plus-agents-plus-harness layer carries the industry-specific “secret sauce” — with the open question, as randy silver pressed, of how defensible those moats actually are when migration cost is low.',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'Jun 5–9',
    },
    {
      title: 'Teaching the Machine Your Voice — “Brand You” Skills',
      description:
        'On 11 June Prachi Garg asked how to get Claude Code to write in her own tone rather than generic AI polish. The community answered with a practical playbook: feed it real examples (Nadia Inv), build a personal “Brand” skill via the skill-creator and pin it in CLAUDE.md (Dan Entwistle’s “Brand Dan”), and train it eval-style with positive and negative examples including your own rewrites (Suvagata Roy). Jason Knight held the dissent: “I prefer human-written text with all its imperfections… tell me your story in your own words!” — to which Erik replied, “the varnish is wearing off — what do you mean you don’t like my CV in pirate 🏴‍☠️.”',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jun 11',
    },
    {
      title: 'Notebook to Markdown — Handwriting OCR in Practice',
      description:
        'On 19 June Graham Reed asked whether anyone had Claude transpose photos of handwritten notes to text (“asking for… me!”). A tidy practical exchange followed: Steve Tooke had done exactly this after a day marshalling a race — photograph, transpose, restructure into an argument as a markdown doc; Joana and Ashwin nudged toward Gemini; Max Mizzi flagged the iPhone Photos built-in text tool at ~90% on neat handwriting. Howi added the human coda on why he still writes by hand — memory, calm, no battery — with digitising finally no longer a chore. The verdict throughout: it works, “you just have to verify.”',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Jun 19',
    },
    {
      title: 'Cherny’s Role Typology — “Sweeper Is Bullshit”',
      description:
        'Late in the month Kim Faura shared Boris Cherny’s five product-team roles — Prototyper, Builder, Sweeper, Grower, Maintainer. It triggered the channel’s sharpest craft debate. Mikkel Nielsen argued builder and sweeper should be the same person (“a builder with taste and a high bar sweeps as they go”). Shannon went further with a long, pointed rebuttal — good PMs have always collapsed this skillset, new products still need strategy not just “build/ship/repeat,” and “I’m sorry but ‘sweeper’ is bullshit — if you didn’t ship crap you wouldn’t need that.” Sascha Brossmann placed it in lineage: “mostly an unrefined ad-hoc take on Wardley’s Pioneers, Settlers and Town Planners,” and lamented how unevenly decades of org-design thinking are distributed across communities of practice.',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Jun 29',
    },
    {
      title: 'The AI-Native SDLC — Requirements Move Back to the Front',
      description:
        'On 25 June Matt Stone’s question about who’s still running autonomous agents heavily opened into a discussion of how the software lifecycle bends around cheap code-gen. Matt Fitz: “most rework is rooted in bad requirements… we are in a moment where that problem possibly compounds.” Nick Jemetta, helping an enterprise client through it, warned against “too much focus on how fast the user stories get written rather than what problem the team is going after and how they’ll measure success.” Maria Chilikov: “the truth is as always in the middle” — best practices today, adapt as it moves. randy silver’s provocation: lean into the mess, let teams learn, since coding is no longer the constraint. Plenty of “wagile” and “wanban” gallows humour along the way.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Jun 25',
    },
    {
      title: 'Governments at the Gate — Staggered Model Releases',
      description:
        'The month closed on the politics of frontier access. Sascha Brossmann surfaced the Reuters report that the US administration asked for staggered releases, with GPT-5.6 going to select partners and the government “approving access customer by customer.” His read was blunt — regulatory capture as the labs’ last resort, and “everywhere outside the US” a self-inflicted wound from the earlier “too dangerous to release” marketing flex. Maria Chilikov wondered whether the whole limited-release drama was “just PR moves… even my mother, a primary-school teacher in her 70s, has now heard of AI models thanks to the buzz.”',
      tags: [{ label: 'Philosophical', variant: 'amber' }],
      dateRange: 'Jun 30',
    },
  ],
}

const aiStats = [
  { label: 'Messages', value: 454 },
  { label: 'Active Members', value: 58 },
  { label: 'Active Days', value: 27 },
  { label: 'New Members', value: '—' },
]

// ── General Channel ──────────────────────────────────────────────────────────

const generalChannel: ChannelData = {
  name: 'General',
  chartColor: '#60a5fa',
  sentimentColor: '#60a5fa',
  dailyVolume: [
    { day: '1', messages: 7 }, { day: '2', messages: 10 }, { day: '3', messages: 66 },
    { day: '4', messages: 37 }, { day: '5', messages: 11 }, { day: '6', messages: 57 },
    { day: '7', messages: 1 }, { day: '9', messages: 2 }, { day: '10', messages: 17 },
    { day: '13', messages: 1 }, { day: '15', messages: 8 }, { day: '16', messages: 10 },
    { day: '17', messages: 40 }, { day: '18', messages: 5 }, { day: '19', messages: 16 },
    { day: '20', messages: 3 }, { day: '21', messages: 2 }, { day: '22', messages: 14 },
    { day: '23', messages: 6 }, { day: '24', messages: 27 }, { day: '25', messages: 3 },
    { day: '26', messages: 14 }, { day: '27', messages: 5 }, { day: '28', messages: 7 },
    { day: '29', messages: 4 },
  ],
  contributors: [
    { name: 'Jason Knight', messages: 33, color: 'rgba(251,146,60,0.7)' },
    { name: 'Shannon', messages: 31, color: 'rgba(167,139,250,0.7)' },
    { name: 'Scotty', messages: 31, color: 'rgba(244,114,182,0.7)' },
    { name: 'Tania', messages: 28, color: 'rgba(248,113,113,0.7)' },
    { name: 'Matt LeMay', messages: 20, color: 'rgba(129,140,248,0.7)' },
    { name: 'Jessie', messages: 19, color: 'rgba(251,191,36,0.7)' },
    { name: 'Sascha Brossmann', messages: 14, color: 'rgba(52,211,153,0.7)' },
    { name: 'Scott Weiss', messages: 13, color: 'rgba(96,165,250,0.7)' },
    { name: 'Caroline Clark', messages: 12, color: 'rgba(45,212,191,0.7)' },
    { name: 'Graham Reed', messages: 11, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 161, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 30 },
    { label: 'Humorous', value: 22 },
    { label: 'Community', value: 20 },
    { label: 'Philosophical', value: 16 },
    { label: 'Personal', value: 12 },
  ],
  trends: [
    {
      title: 'The Karaoke Insurrection — 66 Messages in a Day',
      description:
        'The month’s biggest spike, and its most joyful. Around the Made By Many meet-up on 4 June — set against London tube strikes — a throwaway line about post-event drinks detonated into a full karaoke plot. Scotty (“we hired a karaoke system for my current marriage; marriage doing well too”), Jason Knight (accidental Rammstein in Nuremberg), Emily Tate (Gangster’s Paradise with her Kraków team), Tania, and Jessie all piled in, while Shannon — gutted to be out of London — cheered from the sidelines: “I started something… no regrets. This gang is fun.” Woven through it was genuinely useful strike logistics (Elizabeth line unaffected; Victoria and Northern patchy). Community at full volume.',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'Jun 3–4',
    },
    {
      title: 'The Prioritisation Clinic — Sascha’s Clarity Doctrine',
      description:
        'On 6 June Scott Weiss brought a real dilemma: RICE breaks down when you weigh a performance fix against a growth mechanic because “they don’t sit on the same scale.” The thread became a masterclass. Jason Knight: “you can’t trade off apples and oranges with any framework… RICE, COD, WSJF are all methods to make guesses look scientific.” Shannon shared a seven-factor model and the “bucket-then-prioritise” approach. Then Sascha Brossmann info-dumped a full clinic — Wardley Maps, opportunity-solution trees, Hubbard’s 95% confidence intervals over point scores, black-hat “shoot down this feature” exercises — landing on the line of the month: “Prioritisation is by and large a function of clarity. Scoring models are crutches when clarity is missing.” And the systems coda: “you’re shipping your quality process — don’t just fix the issues, fix the process.”',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'Jun 6–10',
    },
    {
      title: 'The Recruiter Phishing Alarm',
      description:
        'On 17 June Tania flagged a suspicious recruiter — an AI-generated flattery opener, a Gmail domain, “find me on LinkedIn” with no link. The hive mind mobilised. Craig Unsworth named a live scam pattern: “She finds real jobs, sends them to candidates, asks them to apply, and just before the fake interview makes them ‘verify their identity’ — which is a phishing attack. A few junior people really looking for a job have been caught out.” Suvagata Roy shared his own — “offered me chief product officer at Monzo; when I said no, offered me the same at Revolut.” Jessie’s rule: “anyone using Gmail for work sounds dodgy.” The tension broke into the running gag of the month — a chain of members each declaring themselves “CPO of SpaceX,” with Matt LeMay noting Elon “has a habit of impregnating his execs.”',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Jun 17',
    },
    {
      title: 'Prying Open the Books — Commercial Transparency',
      description:
        'Off the back of Matt LeMay’s book talk, Rebecca asked how to get leadership to expose commercial data. Scotty brought the practitioner’s answer with a story: engineers who didn’t normally see financials were told plainly that a security issue put a £1M/year customer at risk — “they focused, fixed, and the customer renewed early.” Caroline Clark: “make best friends with a finance person,” and “when companies aren’t transparent they create a parent-child dynamic… just treat people like adults.” Matt LeMay, candidly: the hard case is founder-led firms where “the approach that best serves the business and the approach that best serves the founder’s feelings diverge.” Silence about numbers, several agreed, is now itself a red flag.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jun 24',
    },
    {
      title: 'The New-Joiner Wave — “Can’t Keep Up With How Fast This Is Growing”',
      description:
        'June brought a steady tide of senior arrivals as the directory was bulk-refreshed. Introductions poured in: Shannon (over from the US), Dan Entwistle (ex Tapi, zero-to-30 product function), Andrew / A. P. (VP Product at Masabi, arriving from Berlin), Suraj (Head of Product for Loyalty at Tesco), Sam (freshly landed from New Zealand), Pete (charity-sector product), plus Anna Lloyd, Gordon, Elaine Owen and Rob Mayes late in the month. Nick Jemetta and Jessie ran the welcomes; the recurring refrain, echoing May, was Nick’s “can’t keep up with how fast this community is growing.”',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Jun 3–26',
    },
    {
      title: 'The Makers Manifesto Lands',
      description:
        'On 19 June Faith Forster unveiled the Makers Manifesto — a set of values and principles for building great products in an AI age, authored by a global group of 44 including Jason Knight, randy silver, Dave Killeen and Matt LeMay. “Read it, sign it, share it — download the Skills MD file and add it to your agents.” AlanArnfeld planned to fold it into an internal ways-of-working workshop. Joana supplied the loyal opposition: “Just wish it didn’t assume that AI is here to stay, in a certain way, and that building without it is no longer possible.” A rare artefact the community helped stress-test in real time.',
      tags: [{ label: 'Industry', variant: 'blue' }],
      dateRange: 'Jun 19',
    },
    {
      title: 'Caroline’s TEDx and the Mars Thread',
      description:
        'On 22 June Caroline Clark previewed her TEDx talk — wearing a commissioned mission patch from an artist who’s designed for NASA and ESA, riffing on “one small step for a woman” and her argument that women should be the first to walk on Mars. It was of a piece with a month where the community’s extraordinary second lives kept surfacing: space-agency mentoring, analogue-astronaut training, and a general willingness to cheer each other’s out-of-comfort-zone leaps. “I felt a bit vulnerable putting it out there, and appreciate all the support.”',
      tags: [{ label: 'Personal', variant: 'pink' }],
      dateRange: 'Jun 22–24',
    },
    {
      title: 'Events Season — Tech Week, MTPCon and a Full Calendar',
      description:
        'A busy month of IRL. London Tech Week and MTPCon London drew a stream of “who’s going / come say hi” (Meg Porter, John Rainey, Sona, Graham Reed, Caroline Clark). randy silver hunted for a host — and later confirmed a free Rich Mironov talk on his new book Money Stories; Jessie trailed a smaller exec-level session for July and the next community-wide event in September; Carla ran Build Better Liverpool. Jason Knight even maintains a public UK events list the group leaned on. The connective tissue of a community that clearly does its best work face to face.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Jun 1–29',
    },
    {
      title: 'Does AI Deserve Its Own Chat?',
      description:
        'On 17 June Scott posed a neat meta-question: in 2026, is AI the niche that should get its own channel, or is it now table stakes — with negotiation, coaching and opportunity development the “real” specialism worth a dedicated space? Laurence bahrami’s deadpan reply — “there is already a CPO Connect // AI channel” — got the laugh, but the underlying point lingered: as AI becomes just another tool, the durable value of the community may be the distinctly human craft of product leadership.',
      tags: [{ label: 'Philosophical', variant: 'amber' }],
      dateRange: 'Jun 17',
    },
  ],
}

const generalStats = [
  { label: 'Messages', value: 373 },
  { label: 'Active Members', value: 82 },
  { label: 'Active Days', value: 25 },
  { label: 'New Members', value: '—' },
]

// ── Jobs Channel ───────────────────────────────────────────────────────────

const jobsChannel: ChannelData = {
  name: 'Jobs',
  chartColor: '#f59e0b',
  sentimentColor: '#f59e0b',
  dailyVolume: [
    { day: '1', messages: 4 }, { day: '2', messages: 7 }, { day: '5', messages: 1 },
    { day: '9', messages: 1 }, { day: '12', messages: 1 }, { day: '16', messages: 8 },
    { day: '17', messages: 4 }, { day: '18', messages: 26 }, { day: '19', messages: 47 },
    { day: '21', messages: 2 }, { day: '22', messages: 3 }, { day: '23', messages: 6 },
    { day: '24', messages: 5 }, { day: '25', messages: 8 }, { day: '26', messages: 26 },
    { day: '28', messages: 58 }, { day: '29', messages: 6 }, { day: '30', messages: 3 },
  ],
  contributors: [
    { name: 'Graham Reed', messages: 28, color: 'rgba(251,146,60,0.7)' },
    { name: 'Caroline Clark', messages: 16, color: 'rgba(167,139,250,0.7)' },
    { name: 'Jamie Webber', messages: 10, color: 'rgba(244,114,182,0.7)' },
    { name: 'James Engelbert', messages: 10, color: 'rgba(248,113,113,0.7)' },
    { name: 'Jason Knight', messages: 10, color: 'rgba(129,140,248,0.7)' },
    { name: 'Sascha Brossmann', messages: 8, color: 'rgba(251,191,36,0.7)' },
    { name: 'Jessie', messages: 8, color: 'rgba(52,211,153,0.7)' },
    { name: 'Mike Ilin', messages: 8, color: 'rgba(96,165,250,0.7)' },
    { name: 'Ahron', messages: 7, color: 'rgba(45,212,191,0.7)' },
    { name: 'Katarina Ryan', messages: 7, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 104, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 34 },
    { label: 'Polarizing', value: 24 },
    { label: 'Philosophical', value: 16 },
    { label: 'Community', value: 14 },
    { label: 'Humorous', value: 12 },
  ],
  trends: [
    {
      title: 'RTO on Trial — 58 Messages in a Day',
      description:
        'The month’s biggest Jobs day (28 June) was a full-throated return-to-office debate, sparked by the interview-process venting the week before. Maria Chilikov set the frame: founders copy office-first signals from OpenAI and Anthropic “whether that’s the reason they’re successful or not.” Graham Reed — two hours from London — carried the opposition: “the issue isn’t the demand to be in the office, it’s the passive-aggressive approach… with what evidence?” Mike Ilin and Ahron argued the founder’s prerogative (“it’s your company, you set the rules; you also get to choose whether to work there”). Mikkel Nielsen reframed it best: “‘Where’s the evidence?’ is the right question when a CEO claims office days boost productivity — that’s a performance claim, back it up or drop it. But a lot of RTO calls are a values choice, and you owe people a clear why.” Sascha Brossmann’s aside: “every AI agent is a 100% remote worker.”',
      tags: [{ label: 'Hottest Moment', variant: 'hot' }],
      dateRange: 'Jun 28',
    },
    {
      title: 'Recruitment Therapy — The Interview-Process Pile-On',
      description:
        'On 19 June Graham Reed opened a rant — final-round rejection after three weeks, the role quietly readvertised the same morning — and the channel poured out its scars. Olivier Thirion de Briel’s “record-breaking” process (five interviews, then the hiring manager away for a month: “the final stage is seeing whether candidates can survive a month with no feedback”); Katarina Ryan’s eight rounds ended with feedback she lacked SaaS experience “they knew from my CV.” The wisdom underneath: Richard Buck — “more than three rounds is a sign of no embedded process or no authority to decide.” Suvagata Roy’s mentor question that reset his own hiring: “are you trying to hire a person and validating they can do the job, or trying to prove how smart you are?” Jamie Webber, half-joking: “Can we do an event on ranting about recruitment processes? Recruitment therapy.”',
      tags: [{ label: 'Hottest Topic', variant: 'hot' }],
      dateRange: 'Jun 19',
    },
    {
      title: 'Rip Up the Ladder — Designing a Fair Product Career Path',
      description:
        'On 18 June James Engelbert asked the group to redesign the product career ladder from scratch, and what “fair” pay really means. The best answers rejected title as a proxy. Martin Röver-Parkes (cross-posted from General): four real levels not six arbitrary ones, “every rung defined by scope of ambiguity, not seniority of tasks… scope plus impact plus replaceability.” Esin argued for “flat and teal — three layers, no junior PMs, it’s not an entry-level role.” Caroline Clark shared an abstraction model she built during a transformation (and created an APM entry point in the end). Carla’s pet hate — “technical PM, growth PM, group PM, staff PM… the role is the role; the rest is just a lens” — with the concession that “sh*t-hot senior PMs” may deserve leadership-level pay.',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'Jun 18',
    },
    {
      title: 'The Market-Glut Check-In',
      description:
        'On 26 June newcomer Gordon asked the question on everyone’s mind: “there seems to be a huge glut of product people looking for work — a posting gets 500+ applicants; 15 years in and I’ve never seen it this bad.” Graham Reed: “so well-trodden there’s a six-foot canyon worn through the ground.” Caroline Clark offered a structural read — companies want perm ICs for delivery control but flexibility at leadership level given uncertainty, “hence the rise of fractional and contract in the middle tier,” plus restructures and ‘product transformations’ pushing tenured people out. Jamie Webber (a recruiter): the market has improved over six months “but it’s incredibly hand-to-mouth and hard to predict.” Gallows humour about “hybrid” roles that mean 4.5 days in the office kept it human.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Jun 26',
    },
    {
      title: 'The Jobs Clinic Becomes a Fixture',
      description:
        'On 18 June Jessie and Jamie Webber announced a drop-in Jobs Clinic — market update, job-hunting tips, making your network work, standing out in a busy market — held on 25 June. The gratitude afterwards was wall-to-wall (Paulo: “incredibly helpful, has me thinking on multiple things to laser in my approach”; Ben Andrews; others). Alongside the earlier proactive-outreach sessions, the recruiters-in-residence pattern is now settled community infrastructure.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Jun 18–25',
    },
    {
      title: 'Contracting Practicalities — Umbrellas, PE vs VC, and Cost-to-Serve',
      description:
        'The channel’s steady service layer. On 16 June Susi Mackeown asked about IR35 umbrella providers and got a fast, unanimous crowd-answer (Paystream well-reviewed by Jamie Webber, Jen, Jessie, Nick Jemetta). John Rainey convened a peer session on how PE versus VC-backed businesses think and what they look for in operating partners (Alyx Priestley, Prachi Garg, Joana, Susi and Sona all in). And David Jarvis’s question on Contact-Centre-as-a-Service surfaced a wave of offers to help from members who’ve led support functions and cost-to-serve programmes.',
      tags: [{ label: 'Practical', variant: 'green' }],
      dateRange: 'Jun 16–25',
    },
    {
      title: 'The Roles Board — Fractional CPTO to Head of Product',
      description:
        'The month’s opportunities flowed steadily: Richard Buck’s fractional CPTO (6 months, UK-based consumer/media); Jessie’s FTC Head of Product for a DTC subscriptions scale-up; Dave McD’s 12-month FTC on the My Sky app; Esin and Dan Entwistle both openly on the market for portfolio-level product leadership; Natalia Jaszczuk seeking advisory / NED work in education and social impact. Michelle Wright closed the month asking for CPO salary benchmarks, and Jessie shared Creation Recruitment’s 2026 Product Team Salary Report — the channel doing exactly what it was built for.',
      tags: [{ label: 'Practical', variant: 'blue' }],
      dateRange: 'Jun 1–30',
    },
  ],
}

const jobsStats = [
  { label: 'Messages', value: 216 },
  { label: 'Active Members', value: 59 },
  { label: 'Active Days', value: 18 },
  { label: 'New Members', value: '—' },
]

// ── Leadership Channel ───────────────────────────────────────────────────────

const leadershipChannel: ChannelData = {
  name: 'Leadership & Culture',
  chartColor: '#34d399',
  sentimentColor: '#34d399',
  dailyVolume: [
    { day: '1', messages: 2 }, { day: '2', messages: 3 }, { day: '9', messages: 1 },
    { day: '12', messages: 5 }, { day: '13', messages: 1 }, { day: '14', messages: 1 },
    { day: '19', messages: 5 }, { day: '21', messages: 4 }, { day: '22', messages: 2 },
  ],
  contributors: [
    { name: 'Dan Entwistle', messages: 5, color: 'rgba(251,146,60,0.7)' },
    { name: 'James Engelbert', messages: 4, color: 'rgba(167,139,250,0.7)' },
    { name: 'Caroline Clark', messages: 2, color: 'rgba(244,114,182,0.7)' },
    { name: 'Erik Schwartz', messages: 2, color: 'rgba(248,113,113,0.7)' },
    { name: 'Ryan Musselwhite', messages: 2, color: 'rgba(129,140,248,0.7)' },
    { name: 'Suvagata Roy', messages: 2, color: 'rgba(251,191,36,0.7)' },
    { name: 'A. P.', messages: 2, color: 'rgba(52,211,153,0.7)' },
    { name: 'Shannon', messages: 2, color: 'rgba(96,165,250,0.7)' },
    { name: 'Esin', messages: 1, color: 'rgba(45,212,191,0.7)' },
    { name: 'Jamie', messages: 1, color: 'rgba(251,146,60,0.5)' },
    { name: 'Others', messages: 1, color: 'rgba(71,85,105,0.5)' },
  ],
  sentiment: [
    { label: 'Practical', value: 30 },
    { label: 'Philosophical', value: 24 },
    { label: 'Community', value: 22 },
    { label: 'Personal', value: 14 },
    { label: 'Enthusiastic', value: 10 },
  ],
  trends: [
    {
      title: 'Who Decides? — Codifying Decision Rights',
      description:
        'The channel’s busiest thread (19 June). Jamie asked how leaders draw the line between decisions an individual PM can take and those that must bubble up. Ryan Musselwhite described how it flexes with structure — near-total delegation in a mature 14-product portfolio, tighter steering in a single-product team. Suvagata Roy offered a clean test: “1) does it change your goals/targets, 2) does it change another team’s, 3) does it have significant cost implications, 4) is it a one-way or two-way door” — adding that decision burden rises when teams are goaled on shipping projects rather than outcomes. Shannon described pulling people into positioning, pricing and strategy to “empower them to make prioritisation and scoping decisions without me.”',
      tags: [{ label: 'Deep Dive', variant: 'blue' }],
      dateRange: 'Jun 19',
    },
    {
      title: 'Dan Entwistle’s Working-Out-Loud Introduction',
      description:
        'On 12 June new joiner Dan Entwistle wrote the month’s most reflective intro — years spent shifting mindsets across orgs on customer-focused problem-solving, experimentation and change, and the honesty about the loneliness of being the senior product-and-tech person “who always had to have the answers, especially among the CMO, CEO and CFO — of course I didn’t, because I was trying stuff out.” His close: “I’m at my best when I can explore problems and options with others. I’m looking to do the same here.” James Engelbert’s welcome — “I hear you! No one can know it all” — set exactly the tone the channel exists for.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Jun 12–13',
    },
    {
      title: '“Agentic First” Operating Models',
      description:
        'On 21 June A. P. (Andrew) opened a thread that bridged the AI and Leadership channels: how are tech orgs across the UK and Europe actually moving PMs toward “Agentic First” operating models and the principles of the Makers Manifesto — and are we anywhere near what voices like Aakash Gupta and Gregor Ojstersek describe? James Engelbert and Matt Fitz (who’d just launched a business focused on exactly this) offered to compare notes, and Shannon described her own inclusive approach to grooming ICs for the shift. A. P. offered to synthesise the takeaways and share them back — the channel’s collaborative instinct at work.',
      tags: [{ label: 'Industry', variant: 'amber' }],
      dateRange: 'Jun 21–22',
    },
    {
      title: 'Better Teams, By Design — Diversity and Portfolio Strategy',
      description:
        'Two quieter, generous shares bookended the month. Esin followed up a call with Roman Pichler’s portfolio-strategy and roadmapping resource — “happy to take it offline, sharing here in case anyone else would benefit.” And on 14 June Caroline Clark published a piece on Artemis III crew selection that doubled as a broader point about team composition: “the science says if you want better performance, put more women on your team.” Small acts of teaching that keep the Leadership channel’s signal high even in a lighter month.',
      tags: [{ label: 'Community', variant: 'green' }],
      dateRange: 'Jun 1–14',
    },
  ],
}

const leadershipStats = [
  { label: 'Messages', value: 24 },
  { label: 'Active Members', value: 11 },
  { label: 'Active Days', value: 9 },
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

export default function June2026() {
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

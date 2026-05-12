import { Navbar } from '@/components/Navbar'
import Footer from '@/components/Footer'
import { motion } from 'framer-motion'

interface FaqItem {
  question: string
  answer: string
}

// The visible answer text and the JSON-LD acceptedAnswer.text MUST match —
// Google penalizes FAQPage rich results when they diverge.
const FAQ: FaqItem[] = [
  {
    question: 'What is CPO Connect?',
    answer:
      'CPO Connect is a private peer community for Chief Product Officers and senior product leaders. We share real conversations, peer-to-peer learning, and lived experience across product strategy, leadership, AI, hiring, and career growth — built on openness, trust, and shared experience.',
  },
  {
    question: 'Who is CPO Connect for?',
    answer:
      'Senior product leaders — Chief Product Officers, VPs of Product, and Heads of Product — across industries, company stages, and geographies. The community is UK-headquartered with international members welcome. All applications are vetted for appropriate seniority.',
  },
  {
    question:
      'How is CPO Connect different from other CPO communities (CPO Circles, CPO Track, PepTalks)?',
    answer:
      'CPO Connect is members-led and trust-first. There are no paid tiers, no scripted programmes, and no sales agendas — just senior product leaders talking honestly with each other. Other communities offer structured curricula, executive education, or paid mastermind formats; CPO Connect is the alternative space where contribution matters more than cash and conversations stay candid.',
  },
  {
    question: 'How do I join?',
    answer:
      'Apply via the application form linked from the home page. We review every application to keep the community senior and relevant. Once approved, you receive an invite to the WhatsApp channels and access to the members area.',
  },
  {
    question: 'Is there a membership fee?',
    answer:
      'No. CPO Connect is free forever — no paywalls, no upsells, no hidden tiers. The community is funded by contributions of time and experience from its members.',
  },
  {
    question: 'What kinds of conversations happen in the community?',
    answer:
      'Each topic has its own WhatsApp channel — currently General, Jobs, AI, Leadership & Culture, Mentoring, Book Club, Get Involved, and P2P Groups. We also publish a monthly chat insights digest summarising trends and themes from the previous month, and run IRL events and peer-to-peer learning circles.',
  },
  {
    question: 'How does the WhatsApp community work? Is it noisy?',
    answer:
      'Conversations are segmented across topic-specific channels so members opt into the topics that matter to them. The community has agreed norms — respect, brevity, contribute as much as you take, no self-promotion or sales pitches. Most members report it is the lowest-noise, highest-signal product community they are part of.',
  },
  {
    question: 'Where is CPO Connect based, and is it international-friendly?',
    answer:
      'CPO Connect is UK-headquartered with most IRL events in London. The WhatsApp community and members area are open to senior product leaders globally — members are spread across Europe, North America, and beyond.',
  },
]

function faqPageJsonLd(items: FaqItem[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  })
}

const Faq = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <section className="py-24 sm:py-32">
          <div className="container max-w-3xl">
            <motion.div
              className="mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
                FAQ
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold mt-3 mb-4 tracking-tight">
                Frequently Asked Questions
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Everything you might want to know about the CPO Connect community —
                who it&apos;s for, how it works, and how to join.
              </p>
            </motion.div>

            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <motion.details
                  key={item.question}
                  className="group rounded-2xl border bg-card p-6 open:shadow-md transition-shadow"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.04 }}
                  open={i === 0}
                >
                  <summary className="font-semibold text-lg cursor-pointer list-none flex items-start justify-between gap-4">
                    <h2 className="text-lg font-semibold leading-snug">
                      {item.question}
                    </h2>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-primary text-2xl leading-none transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    {item.answer}
                  </p>
                </motion.details>
              ))}
            </div>

            <div className="mt-16 p-8 rounded-2xl border bg-primary/5 text-center">
              <h2 className="text-2xl font-bold mb-2">Still have questions?</h2>
              <p className="text-muted-foreground mb-4">
                Drop us a line and we&apos;ll get back to you.
              </p>
              <a
                href="mailto:cpoconnect@googlegroups.com"
                className="text-primary font-medium hover:underline"
              >
                cpoconnect@googlegroups.com
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* FAQPage JSON-LD. The acceptedAnswer.text must match the visible
          answer text exactly — Google de-ranks FAQ rich results on mismatch. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqPageJsonLd(FAQ) }}
      />
    </div>
  )
}

export default Faq

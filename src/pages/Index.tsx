import { Navbar } from "@/components/Navbar"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, MessageSquare, Calendar, Lightbulb } from "lucide-react"

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="container py-24 md:py-32 flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl animate-fade-up">
          The Peer Network for{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Senior Product Leaders
          </span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl">
          An invite-only community where CPOs, VPs of Product, and senior product leaders
          share real challenges, swap strategies, and grow together.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Button size="lg" asChild>
            <a
              href="https://cpoconnect.fillout.com/application"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apply to Join <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#manifesto">Read Our Manifesto</a>
          </Button>
        </div>
      </section>

      {/* Manifesto */}
      <section id="manifesto" className="border-t bg-muted/50">
        <div className="container py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Our Manifesto
            </h2>
            <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
              We believe the best product leaders learn from each other. CPO Connect
              exists to create a space where senior product leaders can be vulnerable,
              share their real challenges, and find actionable advice from peers who
              truly understand. No vendors. No pitches. Just real conversations.
            </p>
          </div>
        </div>
      </section>

      {/* Channels */}
      <section id="channels" className="border-t">
        <div className="container py-20 md:py-28">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center">
            Our Channels
          </h2>
          <p className="mt-4 text-muted-foreground text-center max-w-2xl mx-auto">
            Focused spaces for the conversations that matter most to product leaders.
          </p>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Lightbulb, title: "Strategy", desc: "Product strategy, vision, and roadmap discussions" },
              { icon: Users, title: "Leadership", desc: "Team building, hiring, and organizational design" },
              { icon: MessageSquare, title: "General", desc: "Open forum for any product leadership topic" },
              { icon: Calendar, title: "Events", desc: "Meetups, workshops, and community gatherings" },
            ].map((channel) => (
              <div
                key={channel.title}
                className="rounded-lg border bg-card p-6 text-left hover:shadow-md transition-shadow"
              >
                <channel.icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-lg">{channel.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{channel.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Events */}
      <section id="events" className="border-t bg-muted/50">
        <div className="container py-20 md:py-28 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Events & Gatherings
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Regular meetups, roundtables, and workshops designed for senior product
            leaders to connect and learn from each other.
          </p>
          <Button className="mt-8" variant="outline" asChild>
            <a href="#" onClick={(e) => e.preventDefault()}>
              View Upcoming Events
            </a>
          </Button>
        </div>
      </section>

      {/* Founders */}
      <section id="founders" className="border-t">
        <div className="container py-20 md:py-28 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Founded by Product Leaders
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            CPO Connect was founded by experienced product leaders who saw the need for
            a genuine peer community — free from vendor noise and focused purely on
            helping each other succeed.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} CPO Connect. All rights reserved.
          </p>
          <div className="flex items-center space-x-4">
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

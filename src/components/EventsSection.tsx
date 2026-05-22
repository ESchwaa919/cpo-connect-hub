import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, MapPin } from "lucide-react";

const CALENDAR_URL = "https://lu.ma/cpoconnect";
const EVENTS_API = "/api/events";

// Shape returned by our server-side proxy at /api/events. The proxy
// strips the upstream envelope down to just the fields the card needs
// — see server/routes/events.ts.
type LumaEvent = {
  api_id: string;
  name: string;
  url: string;
  cover_url: string | null;
  start_at: string;
  timezone: string | null;
  location_type: string | null;
  city_state: string | null;
};

const formatDate = (iso: string, tz?: string | null) => {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: tz || "Europe/London",
    }).format(d);
  } catch {
    return "";
  }
};

const formatTime = (iso: string, tz?: string | null) => {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz || "Europe/London",
    }).format(d);
  } catch {
    return "";
  }
};

const locationLabel = (ev: LumaEvent) => {
  if (ev.city_state) return ev.city_state;
  if (ev.location_type === "meet" || ev.location_type === "zoom") return "Online";
  if (ev.location_type === "offline") return "In person";
  return "Online";
};

const EventCardSkeleton = () => (
  <div className="rounded-2xl border bg-card overflow-hidden flex flex-col">
    <div className="aspect-[16/9] bg-muted animate-pulse" />
    <div className="p-5 flex flex-col gap-3">
      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      <div className="h-5 w-full bg-muted rounded animate-pulse" />
      <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
      <div className="h-9 w-full bg-muted rounded animate-pulse mt-2" />
    </div>
  </div>
);

const EventsSection = () => {
  const [events, setEvents] = useState<LumaEvent[] | null>(null);
  const [error, setError] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { hash } = useLocation();

  // React Router's <Link to="/path#events"> updates history via
  // pushState and suppresses the browser's default anchor jump.
  // Re-implement the scroll-into-view ourselves when the hash matches.
  useEffect(() => {
    if (hash !== "#events") return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  useEffect(() => {
    let cancelled = false;
    fetch(EVENTS_API, { headers: { Accept: "application/json" } })
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((data: { events?: LumaEvent[] }) => {
        if (cancelled) return;
        setEvents(data.events || []);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section ref={sectionRef} id="events" className="py-12 sm:py-16">
      <div className="container">
        <motion.div
          className="max-w-2xl mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">Events</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">Meet in person</h2>
          <p className="text-muted-foreground">We run regular events for product leaders across the UK.</p>
        </motion.div>

        {error && (
          <div className="text-muted-foreground">
            <a
              href={CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              See all events on Luma →
            </a>
          </div>
        )}

        {!error && events === null && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        )}

        {!error && events && events.length === 0 && (
          <div className="text-muted-foreground">
            No upcoming events scheduled.{" "}
            <a
              href={CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Follow the calendar on Luma →
            </a>
          </div>
        )}

        {!error && events && events.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {events.map((ev, i) => {
                const date = formatDate(ev.start_at, ev.timezone);
                const time = formatTime(ev.start_at, ev.timezone);
                const cover = ev.cover_url || undefined;
                const eventUrl = `https://lu.ma/${ev.url}`;
                return (
                  <motion.a
                    key={ev.api_id}
                    href={eventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-2xl border bg-card overflow-hidden flex flex-col hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    {cover ? (
                      <div className="aspect-[16/9] overflow-hidden bg-muted">
                        <img
                          src={cover}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[16/9] bg-muted" />
                    )}
                    <div className="p-5 flex flex-col gap-3 flex-1">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {date}
                          {time ? ` · ${time}` : ""}
                        </span>
                      </div>
                      <h3 className="font-semibold text-base leading-snug line-clamp-2">{ev.name}</h3>
                      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{locationLabel(ev)}</span>
                      </div>
                      <span className="mt-auto inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 group-hover:bg-primary/90 transition-colors">
                        Save your spot
                      </span>
                    </div>
                  </motion.a>
                );
              })}
            </div>
            <div className="mt-8">
              <a
                href={CALENDAR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium text-sm"
              >
                See all events on Luma →
              </a>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default EventsSection;

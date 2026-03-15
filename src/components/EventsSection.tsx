import { motion } from "framer-motion";
import { Calendar, MapPin, Clock } from "lucide-react";

const JOIN_URL = "https://cpoconnect.fillout.com/application";

const events = [
  {
    title: "CPO Connect London Launch",
    date: "22 January 2025",
    location: "London",
    time: "Evening",
    status: "Past" as const,
  },
  {
    title: "Hot Topics in Product Leadership",
    date: "29 April 2025",
    location: "AKQA, London",
    time: "6:00 PM – 8:45 PM",
    status: "Upcoming" as const,
  },
];

const EventsSection = () => {
  return (
    <section id="events" className="py-24 sm:py-32">
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

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
          {events.map((evt, i) => (
            <a
              key={evt.title}
              href={JOIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <motion.div
                className={`relative p-6 rounded-2xl border overflow-hidden cursor-pointer transition-all ${
                  evt.status === "Upcoming"
                    ? "border-primary/30 bg-primary/[0.02] group-hover:border-primary/60 group-hover:shadow-md"
                    : "bg-card group-hover:border-primary/40 group-hover:shadow-md"
                }`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                {evt.status === "Upcoming" && (
                  <span className="absolute top-4 right-4 text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">
                    Upcoming
                  </span>
                )}
                {evt.status === "Past" && (
                  <span className="absolute top-4 right-4 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    Past
                  </span>
                )}
                <h3 className="text-lg font-bold pr-20 mb-4">{evt.title}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> {evt.date}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {evt.location}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" /> {evt.time}
                  </div>
                </div>
              </motion.div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EventsSection;

import { motion } from "framer-motion";

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

        <motion.div
          className="max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <iframe
            src="https://luma.com/embed/calendar/cal-FlrNymwoPAxiNWC/events?lt=light"
            width="600"
            height="450"
            frameBorder="0"
            style={{
              border: "1px solid #bfcbda88",
              borderRadius: "4px",
              width: "100%",
              maxWidth: "600px",
              height: "450px",
            }}
            allowFullScreen
            aria-hidden="false"
            tabIndex={0}
            title="CPO Connect upcoming events calendar"
          ></iframe>
        </motion.div>
      </div>
    </section>
  );
};

export default EventsSection;

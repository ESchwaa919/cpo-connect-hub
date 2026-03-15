import { motion } from "framer-motion";
import { Heart, Eye, Users, Briefcase } from "lucide-react";

const purposes = [
  { icon: Heart, title: "Share real stories", desc: "From the front line of product leadership" },
  { icon: Eye, title: "Gain perspective", desc: "On tough challenges and decisions" },
  { icon: Users, title: "Build relationships", desc: "That enrich careers and lives" },
  { icon: Briefcase, title: "Access opportunities", desc: "Jobs, fractional work, collaborations" },
];

const principles = [
  "No paywalls, no upsells.",
  "Respect and brevity in discussion.",
  "Contribute as much as you take.",
  "Quality over quantity.",
];

const ManifestoSection = () => {
  return (
    <section id="manifesto" className="py-24 sm:py-32">
      <div className="container">
        <motion.div
          className="max-w-2xl mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">Our Manifesto</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">Why we exist</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Product leadership can be lonely. Too many senior groups are gated, expensive, or full of noise.
            CPO Connect is the alternative — no hidden agendas, just a space where contribution matters more than cash.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {purposes.map((item, i) => (
            <motion.div
              key={item.title}
              className="p-6 rounded-2xl border bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-4">
                <item.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
              <p className="text-muted-foreground text-sm">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <motion.div
            className="p-8 rounded-2xl bg-primary/5 border"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold mb-6">Our Principles</h3>
            <ul className="space-y-4">
              {principles.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-secondary mt-2 shrink-0" />
                  <span className="text-muted-foreground">{p}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            className="p-8 rounded-2xl border bg-card"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold mb-6">Our Promise</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              This isn't about theory or frameworks. It's about leaders who've lived it,
              learning from each other and collectively raising the bar for product leadership.
            </p>
            <h4 className="font-semibold mb-3">Member expectations</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✦ Add value — share experience, insight, or opportunity</li>
              <li>✦ No self-promotion or hidden agendas</li>
              <li>✦ Respect confidentiality</li>
              <li>✦ Be constructive — challenge ideas, not people</li>
              <li>✦ Help raise the bar for product leadership</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ManifestoSection;

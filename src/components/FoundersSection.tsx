import { motion } from "framer-motion";
import { Linkedin } from "lucide-react";

const founders = [
  { name: "Sarah Baker-White", linkedin: "https://www.linkedin.com/in/sarahbaker/" },
  { name: "Scott Weiss", linkedin: "https://www.linkedin.com/in/scottweiss/" },
  { name: "Jessie Rushton", linkedin: "https://www.linkedin.com/in/jessierushton/" },
  { name: "Gregor Young", linkedin: "https://www.linkedin.com/in/gregoryoung/" },
  { name: "Erik Schwartz", linkedin: "https://www.linkedin.com/in/eschwaa/" },
  { name: "Gokul Raju", linkedin: "https://www.linkedin.com/in/gokulraju/" },
  { name: "Glynn Williams", linkedin: "https://www.linkedin.com/in/glynn-williams-1194983/" },
  { name: "Shiv Khuti", linkedin: "https://www.linkedin.com/in/shivkhuti/" },
  { name: "James Engelbert", linkedin: "https://www.linkedin.com/in/jamesengelbert/" },
];

const FoundersSection = () => {
  return (
    <section id="founders" className="py-24 sm:py-32 bg-muted/50">
      <div className="container">
        <motion.div
          className="text-center max-w-xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">Founders</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">Led by practitioners</h2>
          <p className="text-muted-foreground">
            A small, invite-only circle of product leaders who set tone, standards, and direction.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {founders.map((f, i) => (
            <motion.a
              key={f.name}
              href={f.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center text-center p-5 rounded-2xl border bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              {/* WhatsApp-style founders avatar */}
              <div className="w-16 h-16 rounded-full border-[3px] border-foreground/70 bg-card flex flex-col items-center justify-center mb-3">
                <span className="font-display text-[11px] font-bold leading-tight text-foreground">CPO</span>
                <span className="font-display text-[8px] font-semibold leading-tight text-foreground">Connect</span>
                <span className="font-display text-[6px] font-bold uppercase tracking-wider text-foreground/70 mt-0.5">FOUNDERS</span>
              </div>
              <h3 className="font-semibold text-sm">{f.name}</h3>
              <Linkedin className="h-4 w-4 text-muted-foreground mt-2 group-hover:text-primary transition-colors" />
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FoundersSection;

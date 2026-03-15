import { motion } from "framer-motion";
import infographic from "@/assets/infographic.jpg";

const InfographicSection = () => {
  return (
    <section className="py-24 sm:py-32">
      <div className="container">
        <motion.div
          className="text-center max-w-xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">Inside the Community</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">What we really talk about</h2>
        </motion.div>

        <motion.div
          className="max-w-4xl mx-auto rounded-2xl overflow-hidden border shadow-lg"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <img
            src={infographic}
            alt="Inside CPO Connect: What Product Leaders Really Talk About — covering AI playbooks, leadership culture, mentoring, and more"
            className="w-full h-auto"
            loading="lazy"
          />
        </motion.div>
      </div>
    </section>
  );
};

export default InfographicSection;

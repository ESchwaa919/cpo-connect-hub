import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const JoinSection = () => {
  return (
    <section id="join" className="py-24 sm:py-32 bg-muted/50">
      <div className="container">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">Join Us</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">Ready to connect?</h2>
          <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
            CPO Connect is for people leading teams, owning strategy, and sitting at the exec table.
            All member requests are vetted for appropriate seniority.
          </p>
          <p className="text-sm text-muted-foreground mb-10">
            Free forever. No paywalls. No upsells.
          </p>

          <div className="p-8 sm:p-12 rounded-2xl border bg-card shadow-sm max-w-lg mx-auto">
            <h3 className="text-xl font-bold mb-3">Apply for Membership</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Fill out our short application form. We'll review your profile and get back to you.
            </p>
            <Button
              size="lg"
              className="bg-primary text-primary-foreground px-8 py-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all w-full sm:w-auto"
              asChild
            >
              <a href="https://cpoconnect.fillout.com/application" target="_blank" rel="noopener noreferrer">
                Apply Now <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default JoinSection;

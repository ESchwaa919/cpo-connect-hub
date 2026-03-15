import { motion } from "framer-motion";
import generalIcon from "@/assets/channels/General.png";
import jobsIcon from "@/assets/channels/Jobs.png";
import aiIcon from "@/assets/channels/AI.png";
import leadershipIcon from "@/assets/channels/Leadership.png";
import mentoringIcon from "@/assets/channels/Mentoring.png";
import getInvolvedIcon from "@/assets/channels/GetInvolved.png";
import bookClubIcon from "@/assets/channels/BookClub.png";
import p2pGroupIcon from "@/assets/channels/P2PGroup.png";

const channels = [
  { name: "General", label: "GENERAL", desc: "Open discussion for all members", icon: generalIcon },
  { name: "Jobs", label: "JOBS", desc: "Post and find senior product roles", icon: jobsIcon },
  { name: "AI", label: "AI", desc: "Latest AI developments & implementation", icon: aiIcon },
  { name: "Leadership", label: "LEADERSHIP", desc: "For current and aspiring leaders", icon: leadershipIcon },
  { name: "Mentoring", label: "MENTORING", desc: "Give and receive mentorship", icon: mentoringIcon },
  { name: "Get Involved", label: "GET INVOLVED", desc: "Volunteer, contribute, shape the community", icon: getInvolvedIcon },
  { name: "Book Club", label: "BOOK CLUB", desc: "Read and discuss together", icon: bookClubIcon },
  { name: "P2P Group", label: "P2P GROUP", desc: "Peer-to-peer support circles", icon: p2pGroupIcon },
];

const ChannelsSection = () => {
  return (
    <section id="channels" className="py-24 sm:py-32 bg-muted/50">
      <div className="container">
        <motion.div
          className="text-center max-w-xl mx-auto mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">Channels</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">Focused conversations</h2>
          <p className="text-muted-foreground">Each channel has its own WhatsApp group — join the ones that matter to you.</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {channels.map((ch, i) => (
            <motion.div
              key={ch.name}
              className="flex flex-col items-center text-center gap-3"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <img src={ch.icon} alt={ch.name} className="w-20 h-20 rounded-full object-cover" />
              <p className="text-xs text-muted-foreground leading-snug max-w-[140px]">{ch.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ChannelsSection;

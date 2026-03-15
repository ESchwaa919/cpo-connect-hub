import { Navbar } from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import ChannelsSection from "@/components/ChannelsSection";
import InfographicSection from "@/components/InfographicSection";
import EventsSection from "@/components/EventsSection";
import FoundersSection from "@/components/FoundersSection";
import JoinSection from "@/components/JoinSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <HeroSection />
      <ManifestoSection />
      <ChannelsSection />
      <InfographicSection />
      <EventsSection />
      <FoundersSection />
      <JoinSection />
      <Footer />
    </div>
  );
};

export default Index;

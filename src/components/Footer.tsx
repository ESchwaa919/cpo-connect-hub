import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="py-12 border-t">
      <div className="container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logo} alt="CPO Connect" className="h-8 w-8" />
            <div>
              <span className="font-display text-lg font-bold tracking-tight">
                CPO <span className="text-primary">Connect</span>
              </span>
              <p className="text-sm text-muted-foreground">
                By CPOs, for CPOs. Free forever.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#manifesto" className="hover:text-foreground transition-colors">Manifesto</a>
            <a href="#events" className="hover:text-foreground transition-colors">Events</a>
            <a href="#join" className="hover:text-foreground transition-colors">Join</a>
            <a href="mailto:cpoconnect@groups.google.com" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} CPO Connect. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;

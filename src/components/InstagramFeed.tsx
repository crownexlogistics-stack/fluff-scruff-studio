import { useEffect, useRef } from "react";

const InstagramFeed = () => {
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;
    const s = document.createElement("script");
    s.type = "module";
    s.src = "https://w.behold.so/widget.js";
    document.head.append(s);
  }, []);

  return (
    <section className="py-12 sm:py-20 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <p className="text-accent font-body text-xs uppercase tracking-[0.25em] mb-2 flex items-center justify-center gap-2">
            📸 Instagram 📸
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading text-foreground">
            Follow Us on Instagram 📸
          </h2>
          <a
            href="https://www.instagram.com/fluffandscruff.studio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-accent font-body font-bold text-sm hover:underline"
          >
            @fluffandscruff.studio
          </a>
        </div>

        {/* @ts-ignore */}
        <behold-widget feed-id="wyuur74qPGOxnTc480xe"></behold-widget>

        <p className="text-center text-muted-foreground font-body text-sm mt-6">
          Follow us for daily pup content 🐾
        </p>
      </div>
    </section>
  );
};

export default InstagramFeed;

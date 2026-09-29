// =====================================================================
//  SITE SETTINGS + SERVICES + PORTFOLIO  (edit this file, not the HTML)
// =====================================================================
const SITE = {
  brand: "Adullam Services",
  parent: "",     // shown in the footer ("by Adullam Ventures"); set "" to hide
  instagram: "yourhandle",        // Instagram username, no @
  email: "you@example.com",       // quote requests go here
  whatsapp: "",                   // optional, e.g. "2348012345678" (country code, no +)
  tagline: "AI-powered content & software that actually converts"
};

// Each project: { title, type: "video" | "image", src: "media/file.mp4", poster: "media/thumb.jpg" (optional), note: "short caption" }
// Drop the files in the /media folder and add a line here (or send them to Claude and ask it to add them).
const SERVICES = {
  ugc: {
    icon: "🎬", name: "AI UGC Videos", badge: "MOST POPULAR",
    short: "Authentic, creator-style ads and testimonials without the creator wait time.",
    long: "Scroll-stopping UGC-style videos for TikTok, Reels and Shorts, featuring realistic AI actors and voices, with hooks, scripts and captions handled for you.",
    features: ["Realistic AI actors & voices", "Hooks, scripts & captions", "TikTok / Reels / Shorts formats", "Multiple variations for A/B testing"],
    packages: [
      { name: "Starter", price: "$XX", items: ["1 UGC video (15–30s)", "Script included", "1 revision"] },
      { name: "Growth", price: "$XX", items: ["3 UGC videos", "Different hooks & actors", "2 revisions", "Priority delivery"], featured: true },
      { name: "Scale", price: "$XX", items: ["10 UGC videos", "Full A/B testing set", "Unlimited revisions", "48h turnaround"] }
    ],
    projects: [
      // { title: "Skincare ad", type: "video", src: "media/ugc1.mp4", note: "TikTok ad · 22s" },
    ]
  },
  video: {
    icon: "✨", name: "AI Video Generation", badge: "",
    short: "Cinematic product shots, promos and animated visuals generated from an idea.",
    long: "From product showcases to brand films and social promos, I generate cinematic AI video with motion graphics, music and voiceover included.",
    features: ["Product & brand showcases", "Motion graphics & b-roll", "Music & voiceover included", "Any aspect ratio"],
    packages: [
      { name: "Clip", price: "$XX", items: ["1 video (up to 30s)", "Music included", "1 revision"] },
      { name: "Promo", price: "$XX", items: ["1 video (up to 60s)", "Voiceover + captions", "2 revisions"], featured: true },
      { name: "Campaign", price: "$XX", items: ["5 videos", "Consistent brand style", "Unlimited revisions"] }
    ],
    projects: []
  },
  web: {
    icon: "🌐", name: "Web Development", badge: "",
    short: "Fast, modern, mobile-first websites and landing pages that turn visitors into customers.",
    long: "Custom websites and landing pages designed to look premium and convert, with SEO basics, fast hosting and mobile-first design.",
    features: ["Landing pages & business sites", "E-commerce & booking", "SEO-ready & mobile-first", "Hosted and live"],
    packages: [
      { name: "Landing Page", price: "$XX", items: ["1 page", "Mobile-first", "Contact form", "Live in days"] },
      { name: "Business Site", price: "$XX", items: ["Up to 5 pages", "SEO setup", "Analytics", "2 revisions"], featured: true },
      { name: "E-commerce", price: "$XX", items: ["Online store", "Payments", "Product management", "Training"] }
    ],
    projects: []
  },
  app: {
    icon: "📱", name: "App Development", badge: "",
    short: "Custom web and mobile apps, from MVP to polished product, built with AI-accelerated workflows.",
    long: "From idea to working product: web apps, dashboards and mobile apps, plus AI features and automations, built quickly with modern tools.",
    features: ["Web apps & dashboards", "iOS / Android apps", "AI features & automations", "MVPs shipped fast"],
    packages: [
      { name: "MVP", price: "$XX", items: ["Core features", "Clean UI", "Deployed", "1 revision round"] },
      { name: "Full App", price: "$XX", items: ["Auth & database", "Admin dashboard", "AI integration", "2 revision rounds"], featured: true },
      { name: "Custom", price: "Let's talk", items: ["Complex requirements", "Ongoing support", "Scoped together"] }
    ],
    projects: []
  },
  auto: {
    icon: "⚙️", name: "Automation", badge: "NEW",
    short: "Chatbots, AI agents and workflows that handle the repetitive work for you, 24/7.",
    long: "Stop doing the same tasks by hand. I build automations and AI agents that reply to leads, book clients, post content and move data between your tools while you sleep.",
    features: ["Instagram / WhatsApp DM chatbots", "Lead capture & CRM sync", "Auto-posting & content pipelines", "Email, invoice & booking workflows"],
    packages: [
      { name: "Quick Fix", price: "$XX", items: ["1 automation", "Connects 2 tools", "Tested & documented"] },
      { name: "Workflow", price: "$XX", items: ["Up to 3 automations", "AI chatbot or agent", "2 weeks support"], featured: true },
      { name: "Full System", price: "Let's talk", items: ["End-to-end business automation", "Custom AI agents", "Ongoing support"] }
    ],
    projects: []
  }
};

const FAQ = [
  ["How fast can you deliver?", "AI videos usually take 24–72 hours. Websites take a few days, and apps depend on scope. You get a timeline with every quote."],
  ["Do the AI UGC videos look real?", "Yes. I use top AI actors, voices and editing so they feel native to TikTok and Reels. I'll show you samples in your niche first."],
  ["What if I want changes?", "Every project includes revisions so you end up happy with the result."],
  ["How do I pay?", "Usually a deposit up front and the rest on delivery. Payment options are confirmed in your quote."],
  ["Can I bundle services?", "Absolutely. A site plus a set of UGC ads is a popular combo, with bundle discounts."]
];

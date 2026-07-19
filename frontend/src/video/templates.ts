import type { Scene } from "../types";

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  background: string;
  accent: string;
  scenes: Array<{
    name: string;
    durationInFrames: number;
    transition: "none" | "fade" | "slide" | "scale";
    layout: Scene["layout"];
    background: string;
    accent: string;
    caption: string;
    narration: string;
  }>;
}

export const projectTemplates: ProjectTemplate[] = [
  {
    id: "minimal_tech",
    name: "Minimal Tech Promo",
    description: "Sleek, dark, neon-accented tech promo perfect for SaaS and developer utilities.",
    background: "#0c0c0a",
    accent: "#e6ff5c",
    scenes: [
      {
        name: "Introduction",
        durationInFrames: 90,
        transition: "fade",
        layout: "full",
        background: "#0c0c0a",
        accent: "#e6ff5c",
        caption: "Welcome to the future of app design.",
        narration: "Let us show you how quickly you can make beautiful designs."
      },
      {
        name: "Core Benefit",
        durationInFrames: 90,
        transition: "fade",
        layout: "device",
        background: "#0c0c0a",
        accent: "#e6ff5c",
        caption: "Lightning fast. Locally hosted.",
        narration: "Everything runs locally on your Mac with native hardware performance."
      },
      {
        name: "Power Feature",
        durationInFrames: 90,
        transition: "slide",
        layout: "gradient",
        background: "#0c0c0a",
        accent: "#e6ff5c",
        caption: "Stunning accent highlights.",
        narration: "Focus your audience on your key features with precise highlight highlights."
      },
      {
        name: "Conclusion",
        durationInFrames: 90,
        transition: "fade",
        layout: "full",
        background: "#0c0c0a",
        accent: "#e6ff5c",
        caption: "Get started today. Free trial.",
        narration: "Download Lumiveo and tell your app's story beautifully."
      }
    ]
  },
  {
    id: "vibrant_social",
    name: "Vibrant Social / Marketing",
    description: "Bright, energetic, high-contrast layouts perfect for social media ads and mobile consumer apps.",
    background: "#120a2a",
    accent: "#ff007f",
    scenes: [
      {
        name: "Hook",
        durationInFrames: 75,
        transition: "scale",
        layout: "gradient",
        background: "#120a2a",
        accent: "#ff007f",
        caption: "Stop scrolling! Check this out.",
        narration: "This simple mobile trick will change the way you plan your day."
      },
      {
        name: "Interactive Demo",
        durationInFrames: 90,
        transition: "fade",
        layout: "device",
        background: "#120a2a",
        accent: "#00f0ff",
        caption: "Intuitive gestural interactions.",
        narration: "Swipe, drag, and tap with gorgeous simulated mobile physics."
      },
      {
        name: "Ending Pitch",
        durationInFrames: 90,
        transition: "scale",
        layout: "full",
        background: "#120a2a",
        accent: "#ff007f",
        caption: "Download now on the App Store.",
        narration: "Join over one million users designing better stories today."
      }
    ]
  },
  {
    id: "clean_enterprise",
    name: "Clean Enterprise Showcase",
    description: "Corporate, light-themed layouts focusing on trust, data dashboards, and clean software interfaces.",
    background: "#f4f5f6",
    accent: "#0047ff",
    scenes: [
      {
        name: "Title Card",
        durationInFrames: 90,
        transition: "fade",
        layout: "full",
        background: "#f4f5f6",
        accent: "#0047ff",
        caption: "Enterprise workflows. Simplified.",
        narration: "Manage teams, track milestones, and compile insights on one interface."
      },
      {
        name: "Analytics Focus",
        durationInFrames: 120,
        transition: "slide",
        layout: "split",
        background: "#f4f5f6",
        accent: "#0047ff",
        caption: "Powerful analytics. Real-time updates.",
        narration: "Our dashboard aggregates clean charts to inform your decisions dynamically."
      },
      {
        name: "Closing summary",
        durationInFrames: 90,
        transition: "fade",
        layout: "minimal",
        background: "#f4f5f6",
        accent: "#0047ff",
        caption: "Scale your business with Lumiveo.",
        narration: "Schedule a custom demo call with our enterprise experts today."
      }
    ]
  },
  {
    id: "gradient_aurora",
    name: "Nordic Aurora Promo",
    description: "Soft teal-and-indigo gradients and minimalist frames optimal for lifestyle and wellness apps.",
    background: "#0a1128",
    accent: "#00ffcc",
    scenes: [
      {
        name: "Welcome",
        durationInFrames: 90,
        transition: "fade",
        layout: "minimal",
        background: "#0a1128",
        accent: "#00ffcc",
        caption: "Find your daily moment of zen.",
        narration: "Breathe in, relax your mind, and open your daily breathing assistant."
      },
      {
        name: "Feature focus",
        durationInFrames: 105,
        transition: "scale",
        layout: "gradient",
        background: "#0a1128",
        accent: "#bf5af2",
        caption: "Curated ambient soundscapes.",
        narration: "Listen to high-fidelity nature sounds designed for mindfulness."
      },
      {
        name: "Call to action",
        durationInFrames: 90,
        transition: "fade",
        layout: "device",
        background: "#0a1128",
        accent: "#00ffcc",
        caption: "Start your mindful journey.",
        narration: "Free on iOS and Android devices. Try it now."
      }
    ]
  },
  {
    id: "retro_future",
    name: "Classic Retro-Future Arcade",
    description: "Vintage grid-themed templates perfect for 80s arcade aesthetics, gaming, and creative tools.",
    background: "#1a0b1e",
    accent: "#ff9f0a",
    scenes: [
      {
        name: "Press Start",
        durationInFrames: 90,
        transition: "scale",
        layout: "highlight",
        background: "#1a0b1e",
        accent: "#ff2d55",
        caption: "Insert Coin to Start Your Game.",
        narration: "Get ready to experience high-octane 80s arcade style gaming action."
      },
      {
        name: "Gameplay",
        durationInFrames: 120,
        transition: "slide",
        layout: "device",
        background: "#1a0b1e",
        accent: "#ff9f0a",
        caption: "Classic retro gameplay mechanics.",
        narration: "Dodge obstacles, unlock achievements, and climb the scoreboard."
      },
      {
        name: "Game Over",
        durationInFrames: 90,
        transition: "fade",
        layout: "full",
        background: "#1a0b1e",
        accent: "#ff2d55",
        caption: "High score achieved! Play again?",
        narration: "Challenge your friends and claim your place on the hall of fame today."
      }
    ]
  }
];

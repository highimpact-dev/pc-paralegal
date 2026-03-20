/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sidebar: "#1a1a2e",
        "sidebar-hover": "#16213e",
        accent: "#0f3460",
        "accent-light": "#533483",
        surface: "#f8f9fa",
        "dark-bg": "#0f0f17",
        "dark-surface": "#1a1a28",
        "dark-card": "#22223a",
        "dark-border": "#2a2a42",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#1a1a2e",
        "sidebar-hover": "#16213e",
        accent: "#0f3460",
        "accent-light": "#533483",
        surface: "#f8f9fa",
      },
    },
  },
  plugins: [],
};

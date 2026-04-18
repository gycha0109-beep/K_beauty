/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        sand: "#f6f1ea",
        ink: "#161616",
        clay: "#d8c3ad",
        sage: "#6a7b6b"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(22, 22, 22, 0.08)"
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Brand palette
        navy: {
          DEFAULT: "#0B1F3A",
          50: "#eef1f6",
          100: "#d7dfea",
          600: "#16335a",
          700: "#0B1F3A",
          900: "#071528",
        },
        teal: {
          DEFAULT: "#168A8A",
          50: "#e9f6f6",
          100: "#c8e9e9",
          500: "#1aa0a0",
          600: "#168A8A",
          700: "#0f6d6d",
        },
        orange: {
          DEFAULT: "#FF5A3C",
          50: "#fff0ec",
          100: "#ffdcd3",
          500: "#ff5a3c",
          600: "#f0421f",
        },
        magenta: {
          DEFAULT: "#E83E8C",
          50: "#fdeef5",
          100: "#fad3e5",
          600: "#E83E8C",
        },
        purple: {
          DEFAULT: "#6C3CC7",
          50: "#f2ecfb",
          100: "#e0d2f5",
          600: "#6C3CC7",
          700: "#572ea3",
        },
        ink: {
          DEFAULT: "#202631",
          muted: "#667085",
        },
        cloud: "#F8F8F6",
        mist: "#E8ECF1",
        // Soft status colors — soft green for progress, soft yellow for recovery
        success: {
          DEFAULT: "#168A8A",
          soft: "#e5f4ee",
          border: "#bfe3d3",
          text: "#0f6b52",
        },
        recovery: {
          DEFAULT: "#c07a12",
          soft: "#fdf3df",
          border: "#f0dfae",
          text: "#8a5a11",
        },
        danger: {
          DEFAULT: "#dc2626",
          soft: "#fdecec",
          border: "#f5c6c6",
          text: "#991b1b",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(11, 31, 58, 0.04), 0 6px 20px rgba(11, 31, 58, 0.06)",
        "card-hover": "0 2px 6px rgba(11, 31, 58, 0.08), 0 14px 34px rgba(11, 31, 58, 0.12)",
        sheet: "0 -8px 40px rgba(11, 31, 58, 0.16)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-up": "slide-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

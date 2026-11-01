import { extendTheme, type ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

// AgriNexa palette: forest greens with wheat/soil accents.
const colors = {
  brand: {
    50: "#edf7f0",
    100: "#d2ead9",
    200: "#a8d4b8",
    300: "#7cbd95",
    400: "#55a476",
    500: "#2f6f4e",
    600: "#276043",
    700: "#1b4d3e",
    800: "#14352a",
    900: "#0c241c",
  },
  wheat: {
    50: "#fbf3df",
    100: "#f4e1b2",
    200: "#eccf85",
    300: "#e3bc58",
    400: "#dbae35",
    500: "#d4a017",
    600: "#b08413",
    700: "#8c690f",
    800: "#684e0b",
    900: "#443307",
  },
};

const semanticTokens = {
  colors: {
    "bg.canvas": { default: "#fbfaf6", _dark: "gray.900" },
    "bg.surface": { default: "white", _dark: "gray.800" },
    "bg.subtle": { default: "gray.50", _dark: "whiteAlpha.100" },
    "fg.default": { default: "#14352a", _dark: "whiteAlpha.900" },
    "fg.muted": { default: "#5c6b63", _dark: "whiteAlpha.600" },
    "border.default": { default: "#e4e0d7", _dark: "whiteAlpha.300" },
  },
};

/**
 * Single z-index ladder for the shell.
 *
 * Map overlays previously used a raw `zIndex={1000}`, which painted them over
 * the sticky header: the map container is `position:relative` with no z-index,
 * so it creates no stacking context and its children compete directly with the
 * header. Map overlays now sit *below* `sticky`. Leaflet's own panes occupy
 * 400-700 inside its own container, so they do not collide with these.
 */
export const zIndices = {
  base: 0,
  mapOverlay: 5,
  sticky: 100,
  contextPanel: 500,
  sectionPanel: 600,
  rail: 700,
  contextBar: 800,
  overlay: 1200,
  drawer: 1300,
  modal: 1400,
  palette: 1500,
};

/** Vertical rhythm. Templates apply these so pages stop hand-rolling margins. */
export const density = {
  /** Gap between major page sections. */
  section: 6,
  /** Gap between cards in a grid. */
  card: 4,
  /** Padding inside a card. */
  cardPadding: 4,
  /** Padding inside a compact/nested block. */
  dense: 3,
};

export const layout = {
  railWidth: "76px",
  sectionPanelWidth: "244px",
  contextPanelWidth: "360px",
  contextBarHeight: "56px",
};

export const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  zIndices,
  fonts: {
    heading: `"Fraunces", Georgia, serif`,
    body: `"DM Sans", system-ui, sans-serif`,
  },
  styles: {
    global: {
      "html, body, #root": { minHeight: "100%" },
      body: { bg: "bg.canvas", color: "fg.default" },
      // Honour the OS "reduce motion" setting across Chakra transitions.
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          animationDuration: "0.01ms !important",
          transitionDuration: "0.01ms !important",
        },
      },
    },
  },
  components: {
    Button: { defaultProps: { colorScheme: "brand" } },
    Card: {
      baseStyle: {
        container: { bg: "bg.surface", borderColor: "border.default" },
      },
      variants: {
        /** Default page card: flat, hairline border. */
        surface: {
          container: {
            bg: "bg.surface",
            borderWidth: "1px",
            borderColor: "border.default",
            borderRadius: "xl",
            boxShadow: "none",
          },
        },
        /** Floating panel over a canvas (map overlays, popovers). */
        panel: {
          container: {
            bg: "bg.surface",
            borderWidth: "1px",
            borderColor: "border.default",
            borderRadius: "lg",
            boxShadow: "md",
          },
        },
        /** Nested block inside a card — no border, tinted ground. */
        inset: {
          container: {
            bg: "bg.subtle",
            borderWidth: 0,
            borderRadius: "lg",
            boxShadow: "none",
          },
        },
      },
      defaultProps: { variant: "surface" },
    },
  },
});

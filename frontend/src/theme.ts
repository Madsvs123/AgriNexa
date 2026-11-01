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

export const theme = extendTheme({
  config,
  colors,
  semanticTokens,
  fonts: {
    heading: `"Fraunces", Georgia, serif`,
    body: `"DM Sans", system-ui, sans-serif`,
  },
  styles: {
    global: {
      "html, body, #root": { minHeight: "100%" },
      body: { bg: "bg.canvas", color: "fg.default" },
    },
  },
  components: {
    Button: { defaultProps: { colorScheme: "brand" } },
    Card: {
      baseStyle: {
        container: { bg: "bg.surface", borderColor: "border.default" },
      },
    },
  },
});

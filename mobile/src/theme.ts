export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 32
};

export function createPalette(mode: "light" | "dark") {
  const dark = mode === "dark";
  return {
    dark,
    background: dark ? "#0D1110" : "#F7F8F6",
    surface: dark ? "#151B19" : "#FFFFFF",
    surface2: dark ? "#202825" : "#E9EEEB",
    text: dark ? "#F5F7F5" : "#17201D",
    muted: dark ? "#98A39F" : "#65716D",
    border: dark ? "#2B3531" : "#D9E0DC",
    primary: dark ? "#2BC58B" : "#0D9B6A",
    primarySoft: dark ? "#123B2C" : "#DDF5EA",
    coral: "#F06B62",
    nav: dark ? "#101513" : "#17201D",
    navBorder: dark ? "#313B37" : "#28332F",
    navActive: dark ? "#28312E" : "#35413D",
    navText: "#FFFFFF",
    navMuted: "#AAB4B0"
  };
}

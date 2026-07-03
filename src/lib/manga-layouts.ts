// Manga page layout templates, expressed as CSS Grid. The page is portrait
// (3:4); panels are grid cells with a black border, separated by white gutters
// (the grid gap). Switching layout keeps art for any area name that still exists.

export type MangaLayout = {
  id: string;
  label: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  gridTemplateAreas: string;
  areas: string[];
};

export const MANGA_LAYOUTS: MangaLayout[] = [
  {
    id: "quad-2x2",
    label: "2×2 Quad",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1fr 1fr",
    gridTemplateAreas: `"p1 p2" "p3 p4"`,
    areas: ["p1", "p2", "p3", "p4"],
  },
  {
    id: "tiers-3",
    label: "3 Tiers",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr 1fr 1fr",
    gridTemplateAreas: `"t1" "t2" "t3"`,
    areas: ["t1", "t2", "t3"],
  },
  {
    id: "splash-top-two",
    label: "Splash + Two",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "1.4fr 1fr",
    gridTemplateAreas: `"hero hero" "bl br"`,
    areas: ["hero", "bl", "br"],
  },
  {
    id: "hero-left-stack-3",
    label: "Hero + 3",
    gridTemplateColumns: "1.6fr 1fr",
    gridTemplateRows: "1fr 1fr 1fr",
    gridTemplateAreas: `"hero r1" "hero r2" "hero r3"`,
    areas: ["hero", "r1", "r2", "r3"],
  },
  {
    id: "strip-4",
    label: "4-Strip",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr 1fr 1fr 1fr",
    gridTemplateAreas: `"s1" "s2" "s3" "s4"`,
    areas: ["s1", "s2", "s3", "s4"],
  },
  {
    id: "splash-full",
    label: "Splash",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr",
    gridTemplateAreas: `"splash"`,
    areas: ["splash"],
  },
];

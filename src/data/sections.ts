export const sectionSlugs = [
  "characters",
  "cities",
  "organizations",
  "story-arcs",
  "timeline",
  "concepts",
  "factions",
  "materials"
] as const;

export type SectionSlug = (typeof sectionSlugs)[number];

export type ArchiveSection = {
  slug: SectionSlug;
  label: string;
  singularLabel: string;
  href: string;
  description: string;
  hasDetailPages: boolean;
  icon: "archive" | "person" | "city" | "shield" | "network" | "clock" | "cube" | "folder" | "layers";
};

export const sections: ArchiveSection[] = [
  {
    slug: "characters",
    label: "Characters",
    singularLabel: "Character",
    href: "/characters/",
    description: "Approved character records, affiliations, appearances, and continuity notes.",
    hasDetailPages: true,
    icon: "person"
  },
  {
    slug: "cities",
    label: "Cities",
    singularLabel: "City",
    href: "/cities/",
    description: "City, region, and location records for the official archive.",
    hasDetailPages: true,
    icon: "city"
  },
  {
    slug: "organizations",
    label: "Organizations",
    singularLabel: "Organization",
    href: "/organizations/",
    description: "Institutions, agencies, teams, and group records.",
    hasDetailPages: true,
    icon: "shield"
  },
  {
    slug: "story-arcs",
    label: "Story Arcs",
    singularLabel: "Story Arc",
    href: "/story-arcs/",
    description: "Structured arc records and reading context.",
    hasDetailPages: true,
    icon: "network"
  },
  {
    slug: "timeline",
    label: "Timeline",
    singularLabel: "Timeline Entry",
    href: "/timeline/",
    description: "Chronology records ordered by first appearance or editorial date.",
    hasDetailPages: false,
    icon: "clock"
  },
  {
    slug: "concepts",
    label: "Concepts",
    singularLabel: "Concept",
    href: "/concepts/",
    description: "Rules, systems, and recurring universe ideas.",
    hasDetailPages: true,
    icon: "cube"
  },
  {
    slug: "factions",
    label: "Factions",
    singularLabel: "Faction",
    href: "/factions/",
    description: "Faction and alliance records for the official archive.",
    hasDetailPages: true,
    icon: "folder"
  },
  {
    slug: "materials",
    label: "Materials",
    singularLabel: "Material",
    href: "/materials/",
    description: "Artifacts, resources, substances, and material records.",
    hasDetailPages: true,
    icon: "layers"
  }
];

export function getSection(slug: SectionSlug): ArchiveSection {
  const section = sections.find((item) => item.slug === slug);

  if (!section) {
    throw new Error(`Unknown archive section: ${slug}`);
  }

  return section;
}

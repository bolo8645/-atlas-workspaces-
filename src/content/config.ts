import { defineCollection, z } from "astro:content";
import { sectionSlugs } from "@/data/sections";

const sharedFields = {
  title: z.string(),
  status: z.string().default("Unreviewed"),
  city: z.string().default("Not specified"),
  affiliations: z.array(z.string()).default([]),
  firstAppearance: z.string().default("Not specified"),
  tags: z.array(z.string()).default([]),
  summary: z.string().default("Summary pending approved ASCU content."),
  featuredImage: z.string().default(""),
  lastUpdated: z.coerce.date(),
  relatedSlugs: z.array(z.string()).default([])
};

const archiveCollection = (category: (typeof sectionSlugs)[number]) =>
  defineCollection({
    type: "content",
    schema: z.object({
      ...sharedFields,
      category: z.literal(category)
    })
  });

export const collections = {
  characters: archiveCollection("characters"),
  cities: archiveCollection("cities"),
  organizations: archiveCollection("organizations"),
  "story-arcs": archiveCollection("story-arcs"),
  timeline: archiveCollection("timeline"),
  concepts: archiveCollection("concepts"),
  factions: archiveCollection("factions"),
  materials: archiveCollection("materials")
};

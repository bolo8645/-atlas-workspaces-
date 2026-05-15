import { hasDatabaseUrl } from "@/lib/db-env";
import { prisma } from "@/lib/prisma";

export async function getSiteSearchData() {
  if (!hasDatabaseUrl) return [];

  const [characters, cities, factions, powers, arcs] = await Promise.all([
    prisma.character.findMany({ select: { slug: true, name: true, alias: true }, orderBy: { name: "asc" } }),
    prisma.city.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    prisma.faction.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    prisma.powerSystem.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    prisma.storyArc.findMany({ select: { slug: true, title: true }, orderBy: { order: "asc" } })
  ]);

  return [
    ...characters.map((item) => ({ href: `/characters/${item.slug}`, label: item.alias, eyebrow: item.name })),
    ...cities.map((item) => ({ href: `/cities/${item.slug}`, label: item.name, eyebrow: "City" })),
    ...factions.map((item) => ({ href: `/factions/${item.slug}`, label: item.name, eyebrow: "Faction" })),
    ...powers.map((item) => ({ href: `/power-systems/${item.slug}`, label: item.name, eyebrow: "Power System" })),
    ...arcs.map((item) => ({ href: `/story-arcs/${item.slug}`, label: item.title, eyebrow: "Story Arc" }))
  ];
}

export async function getHomeData() {
  if (!hasDatabaseUrl) {
    return { characters: [], arcs: [], events: [], news: [] };
  }

  const [characters, arcs, events, news] = await Promise.all([
    prisma.character.findMany({
      take: 4,
      orderBy: { name: "asc" },
      include: { homeCity: true, powers: { include: { power: true } } }
    }),
    prisma.storyArc.findMany({ take: 3, orderBy: { order: "asc" } }),
    prisma.timelineEvent.findMany({ take: 4, orderBy: [{ year: "asc" }, { month: "asc" }], include: { city: true } }),
    prisma.newsPost.findMany({ take: 2, where: { isPublished: true }, orderBy: { publishedAt: "desc" } })
  ]);

  return { characters, arcs, events, news };
}

export async function getUniverseStats() {
  if (!hasDatabaseUrl) {
    return { characters: 0, cities: 0, factions: 0, powers: 0, arcs: 0, events: 0 };
  }

  const [characters, cities, factions, powers, arcs, events] = await Promise.all([
    prisma.character.count(),
    prisma.city.count(),
    prisma.faction.count(),
    prisma.powerSystem.count(),
    prisma.storyArc.count(),
    prisma.timelineEvent.count()
  ]);

  return { characters, cities, factions, powers, arcs, events };
}

export async function getCharacters(filters?: { query?: string; faction?: string; power?: string; city?: string }) {
  if (!hasDatabaseUrl) return [];

  return prisma.character.findMany({
    where: {
      AND: [
        filters?.query
          ? {
              OR: [
                { name: { contains: filters.query, mode: "insensitive" } },
                { alias: { contains: filters.query, mode: "insensitive" } },
                { description: { contains: filters.query, mode: "insensitive" } }
              ]
            }
          : {},
        filters?.faction ? { affiliations: { some: { faction: { slug: filters.faction } } } } : {},
        filters?.power ? { powers: { some: { power: { slug: filters.power } } } } : {},
        filters?.city ? { homeCity: { slug: filters.city } } : {}
      ]
    },
    orderBy: { alias: "asc" },
    include: {
      homeCity: true,
      powers: { include: { power: true } },
      affiliations: { include: { faction: true } },
      storyArcs: { include: { storyArc: true } }
    }
  });
}

export async function getCharacter(slug: string) {
  if (!hasDatabaseUrl) return null;

  return prisma.character.findUnique({
    where: { slug },
    include: {
      homeCity: true,
      powers: { include: { power: true } },
      affiliations: { include: { faction: true } },
      storyArcs: { include: { storyArc: true } },
      relationshipsFrom: { include: { to: true } },
      relationshipsTo: { include: { from: true } }
    }
  });
}

export async function getFilterOptions() {
  if (!hasDatabaseUrl) {
    return { cities: [], factions: [], powers: [] };
  }

  const [cities, factions, powers] = await Promise.all([
    prisma.city.findMany({ orderBy: { name: "asc" } }),
    prisma.faction.findMany({ orderBy: { name: "asc" } }),
    prisma.powerSystem.findMany({ orderBy: { name: "asc" } })
  ]);

  return { cities, factions, powers };
}

export async function getCities() {
  if (!hasDatabaseUrl) return [];

  return prisma.city.findMany({
    orderBy: { name: "asc" },
    include: { characters: true, factions: { include: { faction: true } }, events: true }
  });
}

export async function getCity(slug: string) {
  if (!hasDatabaseUrl) return null;

  return prisma.city.findUnique({
    where: { slug },
    include: { characters: true, factions: { include: { faction: true } }, events: { include: { storyArc: true } } }
  });
}

export async function getFactions() {
  if (!hasDatabaseUrl) return [];

  return prisma.faction.findMany({
    orderBy: { name: "asc" },
    include: { members: { include: { character: true } }, locations: { include: { city: true } }, arcs: { include: { storyArc: true } } }
  });
}

export async function getFaction(slug: string) {
  if (!hasDatabaseUrl) return null;

  return prisma.faction.findUnique({
    where: { slug },
    include: { members: { include: { character: true } }, locations: { include: { city: true } }, arcs: { include: { storyArc: true } } }
  });
}

export async function getPowerSystems() {
  if (!hasDatabaseUrl) return [];

  return prisma.powerSystem.findMany({
    orderBy: { name: "asc" },
    include: { characters: { include: { character: true } } }
  });
}

export async function getPowerSystem(slug: string) {
  if (!hasDatabaseUrl) return null;

  return prisma.powerSystem.findUnique({
    where: { slug },
    include: { characters: { include: { character: true } } }
  });
}

export async function getStoryArcs() {
  if (!hasDatabaseUrl) return [];

  return prisma.storyArc.findMany({
    orderBy: { order: "asc" },
    include: { characters: { include: { character: true } }, factions: { include: { faction: true } }, events: true }
  });
}

export async function getStoryArc(slug: string) {
  if (!hasDatabaseUrl) return null;

  return prisma.storyArc.findUnique({
    where: { slug },
    include: {
      characters: { include: { character: true } },
      factions: { include: { faction: true } },
      events: { include: { city: true }, orderBy: [{ year: "asc" }, { month: "asc" }] }
    }
  });
}

export async function getTimeline() {
  if (!hasDatabaseUrl) return [];

  return prisma.timelineEvent.findMany({
    orderBy: [{ year: "asc" }, { month: "asc" }],
    include: { storyArc: true, city: true }
  });
}

export async function getNews() {
  if (!hasDatabaseUrl) return [];

  return prisma.newsPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" }
  });
}

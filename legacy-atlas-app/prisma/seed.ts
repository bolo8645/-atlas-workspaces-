import { PrismaClient } from "@prisma/client";
import { normalizeNavigationSlug } from "../lib/navigation-utils";
import { DEFAULT_WORKSPACE_ID } from "../lib/workspace-constants";

const prisma = new PrismaClient();

async function main() {
  await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {},
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name: "ASCU"
    }
  });

  await seedNavigationNodes();

  await prisma.newsPost.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.factionStoryArc.deleteMany();
  await prisma.characterStoryArc.deleteMany();
  await prisma.characterFaction.deleteMany();
  await prisma.characterPower.deleteMany();
  await prisma.characterRelation.deleteMany();
  await prisma.storyArc.deleteMany();
  await prisma.powerSystem.deleteMany();
  await prisma.factionLocation.deleteMany();
  await prisma.faction.deleteMany();
  await prisma.character.deleteMany();
  await prisma.city.deleteMany();

  const cities = await Promise.all([
    prisma.city.create({
      data: {
        slug: "aurelia-heights",
        name: "Aurelia Heights",
        region: "Upper Atmos Belt",
        imageUrl: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=80",
        description:
          "A vertical metropolis suspended between storm towers, treaty platforms, and private skyports. Every district hears thunder before it hears sirens."
      }
    }),
    prisma.city.create({
      data: {
        slug: "blackglass-harbor",
        name: "Blackglass Harbor",
        region: "Western Rift Coast",
        imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
        description:
          "A flooded port city rebuilt with reflective sea-wall glass after the Rift Tide. Smugglers, weather monks, and corporate salvage crews all claim the docks."
      }
    }),
    prisma.city.create({
      data: {
        slug: "helion-crater",
        name: "Helion Crater",
        region: "Sunken Interior",
        imageUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80",
        description:
          "A radiant impact basin where buried sky-metal sings under the heat. The crater is holy ground, prison, laboratory, and battlefield at once."
      }
    })
  ]);

  const powers = await Promise.all([
    prisma.powerSystem.create({
      data: {
        slug: "aethercasting",
        name: "Aethercasting",
        source: "Charged atmospheric veins opened during the First Fall.",
        limitations: "Requires pressure, breath discipline, and a conductive scar or artifact.",
        description:
          "Aethercasters bend compressed weather into shields, blades, memory echoes, and short-lived constructs."
      }
    }),
    prisma.powerSystem.create({
      data: {
        slug: "riftborne-physiology",
        name: "Riftborne Physiology",
        source: "Cellular exposure to the sky-rifts that tore through the old atmosphere.",
        limitations: "Instability increases under eclipse conditions and near fractured sky-metal.",
        description:
          "Riftborne bodies adapt beyond human baselines, trading resilience and perception for volatile transformations."
      }
    }),
    prisma.powerSystem.create({
      data: {
        slug: "sigil-engineering",
        name: "Sigil Engineering",
        source: "Mathematical glyphwork burned into alloys, streets, and nervous systems.",
        limitations: "Sigils decay when their logic contradicts local reality after major timeline events.",
        description:
          "Engineers compose physical laws as notation, creating weapons, doors, prosthetics, and sentient machines."
      }
    })
  ]);

  const factions = await Promise.all([
    prisma.faction.create({
      data: {
        slug: "the-celestial-accord",
        name: "The Celestial Accord",
        ideology: "Preserve sky-rift treaties at any cost.",
        emblemUrl: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80",
        description:
          "Diplomats, pilots, and oath-bound operatives who keep the fragile peace between altered cities."
      }
    }),
    prisma.faction.create({
      data: {
        slug: "ember-court",
        name: "Ember Court",
        ideology: "Power belongs to whoever survives the sky's judgment.",
        emblemUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80",
        description:
          "A secret aristocracy of crater-born monarchs, assassins, and relic brokers."
      }
    }),
    prisma.faction.create({
      data: {
        slug: "low-orbit-union",
        name: "Low Orbit Union",
        ideology: "No city should own the air above the workers.",
        emblemUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
        description:
          "Dock crews, mechanics, couriers, and ex-heroes building a mutual aid network across storm routes."
      }
    })
  ]);

  await Promise.all([
    prisma.factionLocation.create({ data: { factionId: factions[0].id, cityId: cities[0].id, role: "Treaty headquarters" } }),
    prisma.factionLocation.create({ data: { factionId: factions[1].id, cityId: cities[2].id, role: "Hidden court" } }),
    prisma.factionLocation.create({ data: { factionId: factions[2].id, cityId: cities[1].id, role: "Strike network" } }),
    prisma.factionLocation.create({ data: { factionId: factions[2].id, cityId: cities[0].id, role: "Rooftop relay cells" } })
  ]);

  const arcs = await Promise.all([
    prisma.storyArc.create({
      data: {
        slug: "stormline-genesis",
        title: "Stormline Genesis",
        issueRange: "ASCU: Stormline #1-6",
        order: 1,
        coverUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        summary:
          "A failed rescue in Aurelia Heights reveals the stormline beneath every altered city and forces unlikely rivals into the same sky."
      }
    }),
    prisma.storyArc.create({
      data: {
        slug: "blackglass-vigil",
        title: "Blackglass Vigil",
        issueRange: "Harbor Nocturne #1-5",
        order: 2,
        coverUrl: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80",
        summary:
          "When the harbor walls begin reflecting events that have not happened yet, the city hunts its future criminals."
      }
    }),
    prisma.storyArc.create({
      data: {
        slug: "crater-crown",
        title: "Crater Crown",
        issueRange: "Ember Court #1-8",
        order: 3,
        coverUrl: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
        summary:
          "A succession war in Helion Crater threatens to ignite the sky-metal sleeping below the continent."
      }
    })
  ]);

  const characters = await Promise.all([
    prisma.character.create({
      data: {
        slug: "mara-vale",
        name: "Mara Vale",
        alias: "Skybreaker",
        alignment: "HERO",
        firstAppearance: "ASCU: Stormline #1",
        homeCityId: cities[0].id,
        portraitUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
        description:
          "A rescue pilot who can split storm pressure into luminous hardlight wings.",
        biography:
          "Mara Vale was raised in the maintenance shafts below Aurelia Heights and learned to fly before she learned the city's laws. After the First Fall scarred her lungs with aether, she became Skybreaker: the pilot who dives into impossible weather and returns with survivors."
      }
    }),
    prisma.character.create({
      data: {
        slug: "cassian-rook",
        name: "Cassian Rook",
        alias: "Blackglass",
        alignment: "ANTIHERO",
        firstAppearance: "Harbor Nocturne #1",
        homeCityId: cities[1].id,
        portraitUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
        description:
          "A detective whose reflection moves three seconds ahead of the present.",
        biography:
          "Cassian Rook was a harbor investigator until the Rift Tide left him with a future-facing mirror self. He solves murders by interrogating what almost happened and pays for each glimpse with missing memories."
      }
    }),
    prisma.character.create({
      data: {
        slug: "iserra-hel",
        name: "Iserra Hel",
        alias: "The Crater Queen",
        alignment: "VILLAIN",
        firstAppearance: "Ember Court #1",
        homeCityId: cities[2].id,
        portraitUrl: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80",
        description:
          "A monarch-engineer who writes commands into molten sky-metal.",
        biography:
          "Iserra Hel inherited a broken throne and rebuilt it as a weapon. Her sigils can persuade engines, doors, and bones to remember better versions of themselves, provided those versions obey her."
      }
    }),
    prisma.character.create({
      data: {
        slug: "toma-lark",
        name: "Toma Lark",
        alias: "Relay",
        alignment: "NEUTRAL",
        firstAppearance: "ASCU: Stormline #3",
        homeCityId: cities[1].id,
        portraitUrl: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=900&q=80",
        description:
          "A courier who can turn street noise into encrypted maps and warnings.",
        biography:
          "Toma Lark belongs to everyone who has ever needed a message moved past a checkpoint. Their gift turns a city's noise into routes, debts, and secrets, making them indispensable to heroes and dangerous to regimes."
      }
    })
  ]);

  await Promise.all([
    prisma.characterPower.create({ data: { characterId: characters[0].id, powerId: powers[0].id, mastery: "Elite", notes: "Specializes in rescue-grade pressure wings." } }),
    prisma.characterPower.create({ data: { characterId: characters[1].id, powerId: powers[1].id, mastery: "Unstable", notes: "Precognitive reflection manifests under glass and rain." } }),
    prisma.characterPower.create({ data: { characterId: characters[2].id, powerId: powers[2].id, mastery: "Grandmaster", notes: "Can inscribe living sigils into molten alloys." } }),
    prisma.characterPower.create({ data: { characterId: characters[3].id, powerId: powers[0].id, mastery: "Adept", notes: "Uses vibration traces rather than weather pressure." } }),
    prisma.characterFaction.create({ data: { characterId: characters[0].id, factionId: factions[0].id, role: "Field envoy", status: "Active" } }),
    prisma.characterFaction.create({ data: { characterId: characters[1].id, factionId: factions[2].id, role: "Reluctant investigator", status: "Informal ally" } }),
    prisma.characterFaction.create({ data: { characterId: characters[2].id, factionId: factions[1].id, role: "Sovereign", status: "Ruling" } }),
    prisma.characterFaction.create({ data: { characterId: characters[3].id, factionId: factions[2].id, role: "Courier captain", status: "Active" } }),
    prisma.characterStoryArc.create({ data: { characterId: characters[0].id, storyArcId: arcs[0].id, role: "Lead" } }),
    prisma.characterStoryArc.create({ data: { characterId: characters[1].id, storyArcId: arcs[1].id, role: "Lead" } }),
    prisma.characterStoryArc.create({ data: { characterId: characters[2].id, storyArcId: arcs[2].id, role: "Antagonist" } }),
    prisma.characterStoryArc.create({ data: { characterId: characters[3].id, storyArcId: arcs[0].id, role: "Supporting" } }),
    prisma.factionStoryArc.create({ data: { factionId: factions[0].id, storyArcId: arcs[0].id, role: "Political pressure" } }),
    prisma.factionStoryArc.create({ data: { factionId: factions[2].id, storyArcId: arcs[1].id, role: "Street network" } }),
    prisma.factionStoryArc.create({ data: { factionId: factions[1].id, storyArcId: arcs[2].id, role: "Central conflict" } })
  ]);

  await Promise.all([
    prisma.characterRelation.create({ data: { fromId: characters[0].id, toId: characters[3].id, relation: "Trusted courier" } }),
    prisma.characterRelation.create({ data: { fromId: characters[3].id, toId: characters[0].id, relation: "Emergency contact" } }),
    prisma.characterRelation.create({ data: { fromId: characters[1].id, toId: characters[3].id, relation: "Information broker" } }),
    prisma.characterRelation.create({ data: { fromId: characters[2].id, toId: characters[0].id, relation: "Strategic threat" } })
  ]);

  await Promise.all([
    prisma.timelineEvent.create({
      data: {
        slug: "the-first-fall",
        title: "The First Fall",
        era: "Origin Era",
        year: 0,
        scale: "GLOBAL",
        description: "The upper atmosphere fractured and dropped sky-metal across the world, creating altered cities and unstable power sources."
      }
    }),
    prisma.timelineEvent.create({
      data: {
        slug: "aurelia-stormline-opens",
        title: "Aurelia Stormline Opens",
        era: "Accord Era",
        year: 17,
        month: 4,
        scale: "CITY",
        storyArcId: arcs[0].id,
        cityId: cities[0].id,
        description: "Skybreaker discovers that Aurelia's storm grid is a living pressure vein beneath the city."
      }
    }),
    prisma.timelineEvent.create({
      data: {
        slug: "blackglass-vigil-begins",
        title: "Blackglass Vigil Begins",
        era: "Accord Era",
        year: 18,
        month: 9,
        scale: "REGIONAL",
        storyArcId: arcs[1].id,
        cityId: cities[1].id,
        description: "The harbor walls begin reflecting future crimes, turning prophecy into probable cause."
      }
    }),
    prisma.timelineEvent.create({
      data: {
        slug: "ember-succession",
        title: "The Ember Succession",
        era: "Accord Era",
        year: 19,
        month: 2,
        scale: "COSMIC",
        storyArcId: arcs[2].id,
        cityId: cities[2].id,
        description: "Iserra Hel claims the Crater Crown and wakes the oldest sigil engine below Helion."
      }
    })
  ]);

  await Promise.all([
    prisma.newsPost.create({
      data: {
        slug: "ascu-launch-dossier",
        title: "ASCU Launch Dossier Released",
        excerpt: "The first public atlas of altered cities, factions, and stormline powers is now live.",
        body: "The Accord archives have opened their first wave of records. Begin with Stormline Genesis, then follow the Blackglass Vigil into the harbor timelines.",
        isPublished: true,
        publishedAt: new Date("2026-03-15T12:00:00.000Z")
      }
    }),
    prisma.newsPost.create({
      data: {
        slug: "crater-crown-reading-order",
        title: "Crater Crown Reading Order Updated",
        excerpt: "New issue annotations clarify where Ember Court overlaps with the main Stormline sequence.",
        body: "The recommended reading path now places Ember Court #1 after Harbor Nocturne #3 for the cleanest reveal of the Helion engine.",
        isPublished: true,
        publishedAt: new Date("2026-04-01T12:00:00.000Z")
      }
    })
  ]);
}

async function seedNavigationNodes() {
  await ensureRootNavigationNode({
    title: "Core Concepts",
    description: "Foundational ASCU concepts, rules, terminology, and continuity references.",
    sortOrder: 10
  });
  await ensureRootNavigationNode({
    title: "Storylines",
    description: "Story arcs, issue sequences, and long-running narrative threads.",
    sortOrder: 20
  });
  const locations = await ensureRootNavigationNode({
    title: "Locations",
    description: "Canonical ASCU cities, regions, landmarks, and cosmic locations.",
    sortOrder: 30
  });
  await ensureRootNavigationNode({
    title: "Organizations",
    description: "Groups, factions, institutions, and other organized bodies.",
    sortOrder: 40
  });
  await ensureRootNavigationNode({
    title: "Independent Characters",
    description: "Characters not currently filed under a city-specific branch.",
    sortOrder: 50
  });
  await ensureRootNavigationNode({
    title: "Systems",
    description: "Power systems, operating rules, taxonomies, and other ASCU systems.",
    sortOrder: 60
  });

  const citiesParent = await ensureNavigationNodeUnderParent({
    parentId: locations.id,
    title: "Cities",
    description: "Canonical ASCU city navigation.",
    sortOrder: 10,
    moveExistingToParent: true
  });
  const regionsParent = await ensureNavigationNodeUnderParent({
    parentId: locations.id,
    title: "Regions & Landmarks",
    description: "Forests, bays, ruins, and grounded non-city landmarks.",
    sortOrder: 20,
    moveExistingToParent: true
  });
  const cosmicParent = await ensureNavigationNodeUnderParent({
    parentId: locations.id,
    title: "Cosmic Locations",
    description: "Off-world, celestial, and cosmic-scale ASCU locations.",
    sortOrder: 30,
    moveExistingToParent: true
  });

  const cityNodes = [
    { title: "Skyhaven City", description: "Notes and source material connected to Skyhaven City.", sortOrder: 10 },
    { title: "Dominion City", description: "Notes and source material connected to Dominion City.", sortOrder: 20 },
    { title: "Harbor Pointe", description: "Notes and source material connected to Harbor Pointe.", sortOrder: 30 },
    { title: "Fleetview", description: "Notes and source material connected to Fleetview.", sortOrder: 40 },
    { title: "War Acres", description: "Notes and source material connected to War Acres.", sortOrder: 50 }
  ];

  const citiesByTitle = new Map<string, { id: string }>();
  for (const node of cityNodes) {
    const city = await ensureNavigationNodeUnderParent({
      ...node,
      parentId: citiesParent.id,
      moveExistingToParent: true
    });
    citiesByTitle.set(node.title, city);
  }

  const regionNodes = [
    { title: "Hushwood Forest", description: "Canonical ASCU region or landmark.", sortOrder: 10 },
    { title: "Skyhaven Bay", description: "Canonical ASCU region or landmark.", sortOrder: 20 },
    { title: "The Ruins of Astra", description: "Canonical ASCU region or landmark.", sortOrder: 30 }
  ];

  for (const node of regionNodes) {
    await ensureNavigationNodeUnderParent({
      ...node,
      parentId: regionsParent.id,
      moveExistingToParent: true
    });
  }

  const cosmicNodes = [
    { title: "Astra Prime", description: "Canonical ASCU cosmic location.", sortOrder: 10 },
    { title: "Moon Base", description: "Canonical ASCU cosmic location.", sortOrder: 20 }
  ];

  for (const node of cosmicNodes) {
    await ensureNavigationNodeUnderParent({
      ...node,
      parentId: cosmicParent.id,
      moveExistingToParent: true
    });
  }

  await ensureChildren(citiesByTitle.get("Skyhaven City")?.id, [
    { title: "Heroes", sortOrder: 10 },
    { title: "Anti-Heroes", sortOrder: 20 },
    { title: "Villains", sortOrder: 30 },
    { title: "Other Characters", sortOrder: 40 }
  ]);

  await ensureChildren(citiesByTitle.get("Dominion City")?.id, [
    { title: "Heroes", sortOrder: 10 },
    { title: "Villains", sortOrder: 20 }
  ]);
}

async function ensureRootNavigationNode(input: { title: string; description: string; sortOrder: number }) {
  return ensureNavigationNodeUnderParent({
    ...input,
    parentId: null,
    moveExistingToParent: true
  });
}

async function ensureNavigationNodeUnderParent(input: { title: string; description?: string; sortOrder: number; parentId: string | null; moveExistingToParent?: boolean; reuseExistingElsewhere?: boolean }) {
  const slug = normalizeNavigationSlug(input.title);
  const existingUnderParent = await prisma.navigationNode.findFirst({
    where: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      parentId: input.parentId,
      slug
    },
    select: { id: true }
  });

  if (existingUnderParent) return existingUnderParent;

  const reuseExistingElsewhere = input.reuseExistingElsewhere ?? true;
  const existingBySlug = await prisma.navigationNode.findFirst({
    where: { workspaceId: DEFAULT_WORKSPACE_ID, slug },
    select: { id: true, parentId: true }
  });

  if (existingBySlug && reuseExistingElsewhere) {
    if (input.moveExistingToParent && existingBySlug.parentId !== input.parentId) {
      return prisma.navigationNode.update({
        where: { id: existingBySlug.id },
        data: {
          parentId: input.parentId,
          sortOrder: input.sortOrder
        },
        select: { id: true }
      });
    }

    return existingBySlug;
  }

  return prisma.navigationNode.create({
    data: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      parentId: input.parentId,
      title: input.title,
      slug,
      description: input.description,
      sortOrder: input.sortOrder,
      isVisible: true
    },
    select: { id: true }
  });
}

async function ensureChildren(parentId: string | undefined, children: Array<{ title: string; sortOrder: number }>) {
  if (!parentId) return;

  for (const child of children) {
    await ensureNavigationNodeUnderParent({
      parentId,
      title: child.title,
      sortOrder: child.sortOrder,
      moveExistingToParent: false,
      reuseExistingElsewhere: false
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

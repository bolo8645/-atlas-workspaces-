import { prisma } from "../lib/prisma";
import { normalizeNavigationSlug } from "../lib/navigation-utils";

type AssignmentTarget = {
  id: string;
  title: string;
};

const CITY_RULES = [
  { exact: "Skyhaven City", partial: "Skyhaven" },
  { exact: "Dominion City", partial: "Dominion" },
  { exact: "Harbor Pointe", partial: "Harbor" },
  { exact: "Fleetview", partial: "Fleet" },
  { exact: "War Acres" }
] as const;

const EXACT_LOCATION_RULES = [
  { phrase: "Hushwood Forest", target: "Hushwood Forest" },
  { phrase: "Skyhaven Bay", target: "Skyhaven Bay" },
  { phrase: "The Ruins of Astra", target: "The Ruins of Astra" },
  { phrase: "Astra Prime", target: "Astra Prime" },
  { phrase: "Moon Base", target: "Moon Base" }
] as const;

const REGION_RULES = [
  { phrase: "Hushwood", target: "Hushwood Forest" },
  { phrase: "Astra Prime", target: "Astra Prime" },
  { phrase: "Moon Base", target: "Moon Base" }
] as const;

const CHARACTER_PATTERN = /\bCharacter\b/i;
const ORGANIZATION_PATTERN = /\bOrganization\b/i;
const SYSTEM_PATTERN = /\bPower System\b/i;
const LOCATION_LABEL_PATTERN = /\b(?:Location|City):\s*([^\n\r]+)/gi;
const LABEL_BOUNDARY_PATTERN = /\b(?:Character|Organization|Power System|Event|Related notes|Related|Open questions|Priority|Tags|City|Location):/i;

async function main() {
  const nodes = await prisma.navigationNode.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      parentId: true
    }
  });
  const nodesBySlug = new Map(nodes.map((node) => [node.slug, node]));
  const organizations = nodesBySlug.get(normalizeNavigationSlug("Organizations"));
  const systems = nodesBySlug.get(normalizeNavigationSlug("Systems"));

  const cityTargets = new Map<string, AssignmentTarget>();
  const cityHeroTargets = new Map<string, AssignmentTarget>();
  const locationTargets = new Map<string, AssignmentTarget>();

  for (const { exact: cityName } of CITY_RULES) {
    const city = nodesBySlug.get(normalizeNavigationSlug(cityName));
    if (!city) continue;
    cityTargets.set(cityName, { id: city.id, title: city.title });

    const heroes = nodes.find((node) => node.parentId === city.id && node.slug === normalizeNavigationSlug("Heroes"));
    if (heroes) cityHeroTargets.set(cityName, { id: heroes.id, title: `${city.title} / ${heroes.title}` });
  }

  for (const { target } of EXACT_LOCATION_RULES) {
    const node = nodesBySlug.get(normalizeNavigationSlug(target));
    if (node) locationTargets.set(target, { id: node.id, title: node.title });
  }

  const notes = await prisma.note.findMany({
    where: {
      navigationNodeId: null
    },
    select: {
      id: true,
      title: true,
      sourcePath: true,
      excerpt: true,
      folderName: true,
      notebookName: true,
      importedContent: true,
      plainTextContent: true
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  let assigned = 0;
  let skipped = 0;
  let ambiguous = 0;

  for (const note of notes) {
    const text = [
      note.title,
      note.sourcePath,
      note.excerpt,
      note.folderName,
      note.notebookName,
      note.importedContent,
      note.plainTextContent
    ]
      .filter(Boolean)
      .join("\n");
    const partialMatchText = [
      note.title,
      note.sourcePath,
      note.folderName,
      note.notebookName,
      ...extractLocationLabels(text)
    ]
      .filter(Boolean)
      .join("\n");

    const exactCityMatches = CITY_RULES.filter((rule) => containsText(text, rule.exact)).map((rule) => rule.exact);
    const exactLocationMatches = EXACT_LOCATION_RULES.filter((rule) => containsText(text, rule.phrase)).map((rule) => rule.target);
    const exactTargets = uniqueTargets([
      ...exactCityMatches.map((cityName) => cityTargets.get(cityName)),
      ...exactLocationMatches.map((locationName) => locationTargets.get(locationName))
    ]);

    if (exactTargets.length > 1) {
      ambiguous += 1;
      console.log(`AMBIGUOUS ${note.id}: matched multiple exact targets (${exactTargets.map((target) => target.title).join(", ")})`);
      continue;
    }

    let matchedCity = exactCityMatches.length === 1 ? exactCityMatches[0] : undefined;
    let target = exactTargets[0];
    let reason = target ? "exact match" : "";

    if (!target) {
      const partialCityMatches = CITY_RULES.filter(hasPartialRule)
        .filter((rule) => containsText(partialMatchText, rule.partial))
        .map((rule) => rule.exact);
      const partialTargets = uniqueTargets(partialCityMatches.map((cityName) => cityTargets.get(cityName)));

      if (partialTargets.length > 1) {
        ambiguous += 1;
        console.log(`AMBIGUOUS ${note.id}: matched multiple partial city targets (${partialTargets.map((candidate) => candidate.title).join(", ")})`);
        continue;
      }

      matchedCity = partialCityMatches.length === 1 ? partialCityMatches[0] : undefined;
      target = partialTargets[0];
      reason = target ? "partial city match" : "";
    }

    if (!target) {
      const regionMatches = REGION_RULES.filter((rule) => containsText(text, rule.phrase)).map((rule) => rule.target);
      const regionTargets = uniqueTargets(regionMatches.map((locationName) => locationTargets.get(locationName)));

      if (regionTargets.length > 1) {
        ambiguous += 1;
        console.log(`AMBIGUOUS ${note.id}: matched multiple region targets (${regionTargets.map((candidate) => candidate.title).join(", ")})`);
        continue;
      }

      target = regionTargets[0];
      reason = target ? "region match" : "";
    }

    const isCharacter = CHARACTER_PATTERN.test(text);
    const isOrganization = ORGANIZATION_PATTERN.test(text);

    if (isCharacter && matchedCity) {
      target = cityHeroTargets.get(matchedCity) ?? cityTargets.get(matchedCity) ?? target;
      reason = "character city hint";
    } else if (isOrganization && !isCharacter && organizations) {
      target = { id: organizations.id, title: organizations.title };
      reason = "organization hint";
    } else if (!target && SYSTEM_PATTERN.test(text) && systems) {
      target = { id: systems.id, title: systems.title };
      reason = "system hint";
    }

    if (!target) {
      skipped += 1;
      continue;
    }

    const result = await prisma.note.updateMany({
      where: {
        id: note.id,
        navigationNodeId: null
      },
      data: { navigationNodeId: target.id }
    });
    assigned += result.count;
    if (result.count === 0) skipped += 1;
    else console.log(`ASSIGNED ${note.id}: ${note.title} -> ${target.title} (${reason})`);
  }

  console.log(`Navigation assignment complete. Assigned ${assigned}, skipped ${skipped}, ambiguous ${ambiguous}.`);
}

function containsText(text: string, value: string) {
  return text.toLowerCase().includes(value.toLowerCase());
}

function uniqueTargets(targets: Array<AssignmentTarget | undefined>) {
  return [...new Map(targets.filter((target): target is AssignmentTarget => Boolean(target)).map((target) => [target.id, target])).values()];
}

function extractLocationLabels(text: string) {
  return [...text.matchAll(LOCATION_LABEL_PATTERN)].map((match) => cleanLabelValue(match[1])).filter((value): value is string => Boolean(value));
}

function cleanLabelValue(value: string | undefined) {
  return value?.split(LABEL_BOUNDARY_PATTERN)[0]?.split(/[;,.]/)[0]?.trim();
}

function hasPartialRule(rule: (typeof CITY_RULES)[number]): rule is Extract<(typeof CITY_RULES)[number], { partial: string }> {
  return "partial" in rule;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

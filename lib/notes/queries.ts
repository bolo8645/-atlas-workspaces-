import { NoteStatus, ReviewStatus, type ImportFileStatus, type Prisma } from "@prisma/client";
import { getNavigationNodeAndDescendantIds } from "@/lib/navigation-queries";
import { hasDatabaseUrl } from "@/lib/db-env";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspaces";

type SearchParams = Record<string, string | string[] | undefined>;
type NavigationFilter = { kind: "assigned"; nodeId: string } | { kind: "assignedWithDescendants"; nodeIds: string[] } | { kind: "unassigned" };

export type NotesListResult = Awaited<ReturnType<typeof getNotesList>>;

export async function getDashboardData() {
  if (!hasDatabaseUrl) {
    return {
      totalNotes: 0,
      recentImports: [],
      missingMetadata: 0,
      notesWithWarnings: 0,
      notesWithAttachments: 0,
      orphanNotes: 0,
      recentNotes: [],
      topTags: [],
      topCategories: []
    };
  }

  const workspaceId = await getActiveWorkspaceId();
  const [totalNotes, recentImports, missingMetadata, notesWithWarnings, notesWithAttachments, orphanNotes, recentNotes, topTags, topCategories] = await Promise.all([
    prisma.note.count({ where: { workspaceId } }),
    prisma.importRun.findMany({
      where: { noteEvents: { some: { note: { workspaceId } } } },
      take: 5,
      orderBy: { startedAt: "desc" }
    }),
    prisma.note.count({ where: { workspaceId, AND: [missingMetadataWhere()] } }),
    prisma.note.count({ where: { workspaceId, parseWarnings: { some: {} } } }),
    prisma.note.count({ where: { workspaceId, attachments: { some: {} } } }),
    prisma.note.count({ where: { workspaceId, relatedFrom: { none: {} }, relatedTo: { none: {} } } }),
    prisma.note.findMany({
      where: { workspaceId },
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: { metadataOverride: true, tags: { include: { tag: true }, take: 4 }, categories: { include: { category: true }, take: 2 } }
    }),
    getTopTags(8, workspaceId),
    getTopCategories(8, workspaceId)
  ]);

  return {
    totalNotes,
    recentImports,
    missingMetadata,
    notesWithWarnings,
    notesWithAttachments,
    orphanNotes,
    recentNotes,
    topTags,
    topCategories
  };
}

export async function getNotesList(searchParams: SearchParams = {}) {
  const page = Math.max(1, Number(readParam(searchParams, "page") || "1"));
  const pageSize = Math.min(80, Math.max(10, Number(readParam(searchParams, "pageSize") || "24")));
  if (!hasDatabaseUrl) {
    return {
      notes: [],
      total: 0,
      page,
      pageSize,
      pageCount: 1
    };
  }

  const [fullTextIds, navigationFilter] = await Promise.all([getFullTextNoteIds(searchParams), getNavigationFilter(searchParams)]);
  const workspaceId = await getActiveWorkspaceId();
  const where = buildNotesWhere(searchParams, workspaceId, fullTextIds, navigationFilter);
  const orderBy = buildNotesOrder(readParam(searchParams, "sort"));

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: {
        metadataOverride: true,
        navigationNode: true,
        tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
        categories: { include: { category: true }, orderBy: { category: { name: "asc" } } },
        _count: { select: { attachments: true, parseWarnings: true, relatedFrom: true, relatedTo: true } }
      }
    }),
    prisma.note.count({ where })
  ]);

  return {
    notes,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function getNoteFilters() {
  if (!hasDatabaseUrl) {
    return {
      tags: [],
      categories: [],
      entities: [],
      statuses: Object.values(NoteStatus)
    };
  }

  const workspaceId = await getActiveWorkspaceId();
  const [tags, categories, entities] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" }, take: 200 }),
    prisma.category.findMany({ orderBy: { name: "asc" }, take: 200 }),
    prisma.entity.findMany({ where: { workspaceId }, orderBy: { name: "asc" }, take: 200 })
  ]);

  return {
    tags,
    categories,
    entities,
    statuses: Object.values(NoteStatus)
  };
}

export async function getNoteDetail(id: string) {
  if (!hasDatabaseUrl) return null;

  const workspaceId = await getActiveWorkspaceId();
  return prisma.note.findUnique({
    where: { id, workspaceId },
    include: {
      metadataOverride: true,
      navigationNode: true,
      entity: true,
      tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
      categories: { include: { category: true }, orderBy: { category: { name: "asc" } } },
      attachments: { orderBy: { fileName: "asc" } },
      links: { include: { targetNote: true }, orderBy: { createdAt: "asc" } },
      inboundLinks: { include: { note: true }, orderBy: { createdAt: "asc" } },
      entities: { include: { entity: true }, orderBy: { confidence: "desc" } },
      parseWarnings: { orderBy: { createdAt: "desc" }, take: 25 },
      importEvents: { include: { importRun: true }, orderBy: { createdAt: "desc" }, take: 10 },
      relatedFrom: { include: { toNote: { include: { metadataOverride: true } } }, orderBy: { confidence: "desc" } },
      relatedTo: { include: { fromNote: { include: { metadataOverride: true } } }, orderBy: { confidence: "desc" } }
    }
  });
}

export async function getRelationshipTargets(noteId: string) {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  return prisma.note.findMany({
    where: { workspaceId, id: { not: noteId } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, sourcePath: true, metadataOverride: true }
  });
}

export async function getImportHistory() {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  return prisma.importRun.findMany({
    where: { noteEvents: { some: { note: { workspaceId } } } },
    take: 50,
    orderBy: { startedAt: "desc" },
    include: {
      errors: { take: 5, orderBy: { createdAt: "desc" } },
      reviewItems: { take: 5, orderBy: { createdAt: "desc" } },
      _count: { select: { errors: true, parseWarnings: true, noteEvents: true, reviewItems: true } }
    }
  });
}

export async function getTagsPage() {
  if (!hasDatabaseUrl) return [];

  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { notes: true } } }
  });
}

export async function getCategoriesPage() {
  if (!hasDatabaseUrl) return [];

  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { notes: true } } }
  });
}

export async function getAttachmentsPage() {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  return prisma.attachment.findMany({
    where: { note: { workspaceId } },
    orderBy: [{ kind: "asc" }, { fileName: "asc" }],
    include: { note: { include: { metadataOverride: true } } },
    take: 300
  });
}

export async function getReviewItems(status: ReviewStatus = ReviewStatus.OPEN) {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  return prisma.reviewItem.findMany({
    where: { status, OR: [{ note: { workspaceId } }, { candidateNote: { workspaceId } }] },
    orderBy: { createdAt: "desc" },
    include: {
      note: { include: { metadataOverride: true } },
      candidateNote: { include: { metadataOverride: true } },
      importRun: true
    },
    take: 200
  });
}

async function getFullTextNoteIds(searchParams: SearchParams) {
  if (!hasDatabaseUrl) return undefined;

  const query = readParam(searchParams, "q");
  const scope = readParam(searchParams, "scope") || "all";
  if (!query || scope === "title") return undefined;
  const workspaceId = await getActiveWorkspaceId();

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Note"
    WHERE "workspaceId" = ${workspaceId}
      AND to_tsvector('english', coalesce("title", '') || ' ' || coalesce("plainTextContent", '') || ' ' || coalesce("excerpt", ''))
      @@ plainto_tsquery('english', ${query})
    ORDER BY ts_rank(
      to_tsvector('english', coalesce("title", '') || ' ' || coalesce("plainTextContent", '') || ' ' || coalesce("excerpt", '')),
      plainto_tsquery('english', ${query})
    ) DESC
    LIMIT 5000
  `;

  return rows.map((row) => row.id);
}

async function getNavigationFilter(searchParams: SearchParams): Promise<NavigationFilter | undefined> {
  const nodeId = readParam(searchParams, "node");
  if (!nodeId) return undefined;
  if (nodeId === "unassigned") return { kind: "unassigned" };
  if (readParam(searchParams, "includeDescendants") === "true") return { kind: "assignedWithDescendants", nodeIds: await getNavigationNodeAndDescendantIds(nodeId) };
  return { kind: "assigned", nodeId };
}

function buildNotesWhere(searchParams: SearchParams, workspaceId: string, fullTextIds?: string[], navigationFilter?: NavigationFilter): Prisma.NoteWhereInput {
  const conditions: Prisma.NoteWhereInput[] = [{ workspaceId }];
  const query = readParam(searchParams, "q");
  const scope = readParam(searchParams, "scope") || "all";
  const tag = readParam(searchParams, "tag");
  const category = readParam(searchParams, "category");
  const entity = readParam(searchParams, "entity");
  const status = readParam(searchParams, "status");
  const importStatus = readParam(searchParams, "importStatus") as ImportFileStatus | undefined;
  const from = parseDate(readParam(searchParams, "from"));
  const to = parseDate(readParam(searchParams, "to"));
  const hasAttachments = readParam(searchParams, "hasAttachments");
  const missingMetadata = readParam(searchParams, "missingMetadata");
  const warnings = readParam(searchParams, "warnings");

  if (query) {
    const contains = { contains: query, mode: "insensitive" as const };
    const fullTextMatch = fullTextIds && fullTextIds.length > 0 ? [{ id: { in: fullTextIds } }] : [];
    if (scope === "title") conditions.push({ OR: [{ title: contains }, { metadataOverride: { is: { displayTitle: contains } } }] });
    else if (scope === "body") conditions.push({ OR: [...fullTextMatch, { plainTextContent: contains }] });
    else {
      conditions.push({
        OR: [
          ...fullTextMatch,
          { title: contains },
          { plainTextContent: contains },
          { excerpt: contains },
          { sourcePath: contains },
          { metadataOverride: { is: { displayTitle: contains } } },
          { metadataOverride: { is: { summary: contains } } }
        ]
      });
    }
  }

  if (tag) conditions.push({ tags: { some: { tag: { slug: tag } } } });
  if (category) conditions.push({ categories: { some: { category: { slug: category } } } });
  if (entity) conditions.push({ entities: { some: { entity: { slug: entity } } } });
  if (navigationFilter?.kind === "unassigned") conditions.push({ navigationNodeId: null });
  if (navigationFilter?.kind === "assigned") conditions.push({ navigationNodeId: navigationFilter.nodeId });
  if (navigationFilter?.kind === "assignedWithDescendants") conditions.push({ navigationNodeId: { in: navigationFilter.nodeIds.length > 0 ? navigationFilter.nodeIds : ["__missing_navigation_node__"] } });
  if (status && Object.values(NoteStatus).includes(status as NoteStatus)) conditions.push({ status: status as NoteStatus });
  if (importStatus) conditions.push({ importEvents: { some: { status: importStatus } } });
  if (from || to) conditions.push({ importedAt: { gte: from, lte: to } });
  if (hasAttachments === "true") conditions.push({ attachments: { some: {} } });
  if (missingMetadata === "true") conditions.push(missingMetadataWhere());
  if (warnings === "true") conditions.push({ parseWarnings: { some: {} } });

  return conditions.length > 0 ? { AND: conditions } : {};
}

function buildNotesOrder(sort?: string): Prisma.NoteOrderByWithRelationInput[] {
  if (sort === "title") return [{ title: "asc" }];
  if (sort === "updatedDate") return [{ updatedDate: "desc" }, { updatedAt: "desc" }];
  if (sort === "importedAt") return [{ importedAt: "desc" }];
  return [{ updatedAt: "desc" }];
}

function missingMetadataWhere(): Prisma.NoteWhereInput {
  return {
    OR: [{ tags: { none: {} } }, { categories: { none: {} } }, { status: NoteStatus.NEW }]
  };
}

async function getTopTags(take: number, workspaceId: string) {
  if (!hasDatabaseUrl) return [];

  const groups = await prisma.noteTag.groupBy({
    by: ["tagId"],
    where: { note: { workspaceId } },
    _count: { tagId: true },
    orderBy: { _count: { tagId: "desc" } },
    take
  });
  const tags = await prisma.tag.findMany({ where: { id: { in: groups.map((group) => group.tagId) } } });
  return groups.map((group) => ({ tag: tags.find((tag) => tag.id === group.tagId), count: group._count.tagId })).filter((item) => item.tag);
}

async function getTopCategories(take: number, workspaceId: string) {
  if (!hasDatabaseUrl) return [];

  const groups = await prisma.noteCategory.groupBy({
    by: ["categoryId"],
    where: { note: { workspaceId } },
    _count: { categoryId: true },
    orderBy: { _count: { categoryId: "desc" } },
    take
  });
  const categories = await prisma.category.findMany({ where: { id: { in: groups.map((group) => group.categoryId) } } });
  return groups.map((group) => ({ category: categories.find((category) => category.id === group.categoryId), count: group._count.categoryId })).filter((item) => item.category);
}

function readParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

import type { ReactNode } from "react";
import { PageShell } from "@/components/PageShell";
import { createNavigationNodeAction, deleteNavigationNodeAction, updateNavigationNodeAction } from "@/lib/navigation-actions";
import { getNavigationNodeOptions, getNavigationTree, type NavigationNodeOption, type NavigationTreeNode } from "@/lib/navigation-queries";

export default async function AdminNavigationPage() {
  const [tree, options] = await Promise.all([getNavigationTree(), getNavigationNodeOptions()]);

  return (
    <PageShell eyebrow="Admin" title="Navigation Manager" intro="Create, edit, move, and safely delete the database-owned ASCU navigation tree.">
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <section className="rounded border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black text-white">Create Node</h2>
          <p className="mt-2 text-sm leading-6 text-stone-400">Slugs are normalized to lowercase dash-separated paths. Leave the parent empty for a root node.</p>
          <form action={createNavigationNodeAction} className="mt-5 space-y-4">
            <Field label="Parent">
              <ParentSelect name="parentId" options={options} />
            </Field>
            <Field label="Title">
              <input name="title" required className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
            </Field>
            <Field label="Slug">
              <input name="slug" placeholder="auto from title" className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
            </Field>
            <Field label="Description">
              <textarea name="description" rows={4} className="w-full rounded border border-white/[0.12] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--signal)]" />
            </Field>
            <Field label="Sort order">
              <input name="sortOrder" type="number" placeholder="auto" className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-stone-300">
              <input name="isVisible" type="checkbox" defaultChecked />
              Visible in sidebar
            </label>
            <button className="h-11 w-full rounded bg-[var(--ember)] px-4 text-sm font-bold text-white transition hover:bg-[#b73525]">Create Node</button>
          </form>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-white">Current Tree</h2>
              <p className="mt-1 text-sm text-stone-400">Move nodes by changing their parent. Delete is only available for empty leaf nodes.</p>
            </div>
            <p className="text-sm text-stone-500">{options.length} nodes</p>
          </div>
          {tree.length > 0 ? <AdminNavigationTree nodes={tree} options={options} /> : <p className="rounded border border-white/10 bg-white/[0.04] p-6 text-stone-400">No navigation nodes yet.</p>}
        </section>
      </div>
    </PageShell>
  );
}

function AdminNavigationTree({ nodes, options, depth = 0 }: { nodes: NavigationTreeNode[]; options: NavigationNodeOption[]; depth?: number }) {
  return (
    <div className={depth === 0 ? "space-y-4" : "ml-4 mt-4 space-y-4 border-l border-white/10 pl-4"}>
      {nodes.map((node) => (
        <NavigationNodeEditor key={node.id} node={node} options={options} depth={depth} />
      ))}
    </div>
  );
}

function NavigationNodeEditor({ node, options, depth }: { node: NavigationTreeNode; options: NavigationNodeOption[]; depth: number }) {
  const unavailableParentIds = new Set([node.id, ...collectDescendantIds(node)]);
  const parentOptions = options.filter((option) => !unavailableParentIds.has(option.id));
  const canDelete = node.children.length === 0 && node.directNoteCount === 0;

  return (
    <article className="rounded border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{node.fullPath}</p>
          <h3 className="mt-2 text-xl font-black text-white">{node.title}</h3>
          {node.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">{node.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-stone-400">
          <Badge>{node.directNoteCount} direct notes</Badge>
          <Badge>{node.descendantNoteCount} with descendants</Badge>
          <Badge>{node.children.length} children</Badge>
          <Badge>{node.isVisible ? "visible" : "hidden"}</Badge>
        </div>
      </div>

      <form action={updateNavigationNodeAction} className="mt-5 grid gap-3 lg:grid-cols-6">
        <input type="hidden" name="id" value={node.id} />
        <Field label="Title">
          <input name="title" defaultValue={node.title} required className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
        </Field>
        <Field label="Slug">
          <input name="slug" defaultValue={node.slug} className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
        </Field>
        <Field label="Parent / move">
          <ParentSelect name="parentId" options={parentOptions} defaultValue={node.parentId ?? ""} />
        </Field>
        <Field label="Sort">
          <input name="sortOrder" type="number" defaultValue={node.sortOrder} className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
        </Field>
        <label className="flex h-10 items-center gap-2 rounded border border-white/[0.12] bg-black/30 px-3 text-sm text-stone-300">
          <input name="isVisible" type="checkbox" defaultChecked={node.isVisible} />
          Visible
        </label>
        <button className="h-10 rounded bg-[var(--ember)] px-4 text-sm font-bold text-white transition hover:bg-[#b73525]">Save</button>
        <label className="block lg:col-span-6">
          <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-stone-500">Description</span>
          <textarea name="description" defaultValue={node.description ?? ""} rows={3} className="w-full rounded border border-white/[0.12] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--signal)]" />
        </label>
      </form>

      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-stone-500">{canDelete ? "This node is empty and can be deleted." : "Delete is blocked until child nodes and assigned notes are moved."}</p>
        <form action={deleteNavigationNodeAction}>
          <input type="hidden" name="id" value={node.id} />
          <button disabled={!canDelete} className="h-10 rounded border border-white/10 px-4 text-sm font-bold text-stone-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
            Delete
          </button>
        </form>
      </div>

      {node.children.length > 0 ? <AdminNavigationTree nodes={node.children} options={options} depth={depth + 1} /> : null}
    </article>
  );
}

function ParentSelect({ name, options, defaultValue = "" }: { name: string; options: NavigationNodeOption[]; defaultValue?: string }) {
  return (
    <select name={name} defaultValue={defaultValue} className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]">
      <option value="">Root</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {`${"  ".repeat(option.depth)}${option.title}`}
        </option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-stone-500">{label}</span>
      {children}
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded border border-white/10 px-2 py-1">{children}</span>;
}

function collectDescendantIds(node: NavigationTreeNode): string[] {
  return node.children.flatMap((child) => [child.id, ...collectDescendantIds(child)]);
}

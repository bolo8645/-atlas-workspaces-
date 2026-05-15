"use server";

import { revalidatePath } from "next/cache";
import { createRelationship, createRelationshipType, deleteRelationship, updateRelationship } from "@/lib/relationships";

export async function createRelationshipAction(input: { entityAId: string; entityBId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; type?: string; description?: string | null }) {
  const relationship = await createRelationship(input);
  revalidatePath("/notes");
  return relationship;
}

export async function createRelationshipTypeAction(name: string) {
  const relationshipType = await createRelationshipType(name);
  revalidatePath("/notes");
  return relationshipType;
}

export async function updateRelationshipAction(input: { relationshipId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) {
  const relationship = await updateRelationship(input);
  revalidatePath("/notes");
  return relationship;
}

export async function deleteRelationshipAction(relationshipId: string) {
  await deleteRelationship(relationshipId);
  revalidatePath("/notes");
}

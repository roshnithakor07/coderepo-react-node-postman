import { z } from "zod";

// Builds the schema for a partial update (PUT with only the fields to change)
// from a create schema. `schema.partial()` isn't enough: zod still applies each
// field's `.default()` when the field is missing, so an update carrying only
// `{ name }` would reset every defaulted field — wiping a saved request's URL
// and params, a collection's description, or an environment's `isActive`.
// Here every field is optional with its default removed, so fields the client
// didn't send are left exactly as stored.
export function updateSchemaFrom(schema) {
	const shape = Object.fromEntries(
		Object.entries(schema.shape).map(([key, field]) => [key, (field.def?.type === "default" ? field.def.innerType : field).optional()]),
	);
	return z.object(shape).strict();
}

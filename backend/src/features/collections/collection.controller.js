import { z } from "zod";
import { collectionService } from "./collection.service.js";
import { updateSchemaFrom } from "../../shared/utils/update-schema.js";

const collectionSchema = z
	.object({
		name: z.string().min(1).max(200).trim(),
		description: z.string().max(1000).default(""),
	})
	.strict();

const headerParamSchema = z.object({
	key: z.string(),
	value: z.string(),
	enabled: z.boolean().default(true),
	description: z.string().max(500).optional(),
});

const authSchema = z.object({
	type: z.enum(["none", "bearer", "basic", "apikey"]).default("none"),
	token: z.string().optional(),
	username: z.string().optional(),
	password: z.string().optional(),
	apiKeyName: z.string().optional(),
	apiKeyValue: z.string().optional(),
	apiKeyIn: z.enum(["header", "query"]).optional(),
});

const requestSchema = z
	.object({
		name: z.string().min(1).max(200).trim(),
		method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).default("GET"),
		url: z.string().max(2048).default(""),
		headers: z.array(headerParamSchema).default([]),
		params: z.array(headerParamSchema).default([]),
		body: z.string().default(""),
		bodyType: z.enum(["none", "json", "form", "text", "xml"]).default("none"),
		auth: authSchema.default({}),
		description: z.string().max(1000).default(""),
	})
	.strict();

const collectionUpdateSchema = updateSchemaFrom(collectionSchema);
const requestUpdateSchema = updateSchemaFrom(requestSchema);

export async function listCollections(request, response, next) {
	try {
		response.json({ data: await collectionService.list(request.account._id) });
	} catch (error) {
		next(error);
	}
}

export async function createCollection(request, response, next) {
	try {
		const data = collectionSchema.parse(request.body);
		response.status(201).json({ data: await collectionService.create(request.account._id, data) });
	} catch (error) {
		next(error);
	}
}

export async function updateCollection(request, response, next) {
	try {
		const data = collectionUpdateSchema.parse(request.body);
		response.json({ data: await collectionService.update(request.params.id, request.account._id, data) });
	} catch (error) {
		next(error);
	}
}

export async function deleteCollection(request, response, next) {
	try {
		await collectionService.remove(request.params.id, request.account._id);
		response.status(204).end();
	} catch (error) {
		next(error);
	}
}

export async function createRequest(request, response, next) {
	try {
		const data = requestSchema.parse(request.body);
		response.status(201).json({ data: await collectionService.createRequest(request.params.id, request.account._id, data) });
	} catch (error) {
		next(error);
	}
}

export async function updateRequest(request, response, next) {
	try {
		const data = requestUpdateSchema.parse(request.body);
		response.json({ data: await collectionService.updateRequest(request.params.id, request.account._id, data) });
	} catch (error) {
		next(error);
	}
}

export async function deleteRequest(request, response, next) {
	try {
		await collectionService.removeRequest(request.params.id, request.account._id);
		response.status(204).end();
	} catch (error) {
		next(error);
	}
}

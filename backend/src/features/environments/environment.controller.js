import { z } from "zod";
import { environmentService } from "./environment.service.js";

const variableSchema = z.object({
	key: z.string().min(1).max(200).trim(),
	value: z.string().default(""),
	enabled: z.boolean().default(true),
});

const environmentSchema = z
	.object({
		name: z.string().min(1).max(200).trim(),
		isActive: z.boolean().default(false),
		variables: z.array(variableSchema).default([]),
	})
	.strict();

export async function listEnvironments(request, response, next) {
	try {
		response.json({ data: await environmentService.list(request.account._id) });
	} catch (error) {
		next(error);
	}
}

export async function createEnvironment(request, response, next) {
	try {
		const data = environmentSchema.parse(request.body);
		response.status(201).json({ data: await environmentService.create(request.account._id, data) });
	} catch (error) {
		next(error);
	}
}

export async function updateEnvironment(request, response, next) {
	try {
		const data = environmentSchema.partial().parse(request.body);
		response.json({ data: await environmentService.update(request.params.id, request.account._id, data) });
	} catch (error) {
		next(error);
	}
}

export async function activateEnvironment(request, response, next) {
	try {
		response.json({ data: await environmentService.activate(request.params.id, request.account._id) });
	} catch (error) {
		next(error);
	}
}

export async function deleteEnvironment(request, response, next) {
	try {
		await environmentService.remove(request.params.id, request.account._id);
		response.status(204).end();
	} catch (error) {
		next(error);
	}
}

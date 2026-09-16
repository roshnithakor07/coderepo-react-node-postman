import { z } from "zod";
import { snippetService } from "./snippet.service.js";
import { environmentRepository } from "../environments/environment.repository.js";

const snippetSchema = z
	.object({
		method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
		url: z.string().max(2048).default(""),
		headers: z.array(z.object({ key: z.string(), value: z.string(), enabled: z.boolean().default(true) })).default([]),
		params: z.array(z.object({ key: z.string(), value: z.string(), enabled: z.boolean().default(true) })).default([]),
		body: z.string().default(""),
		bodyType: z.enum(["none", "json", "form", "text", "xml"]).default("none"),
		auth: z
			.object({
				type: z.enum(["none", "bearer", "basic", "apikey"]).default("none"),
				token: z.string().optional(),
				username: z.string().optional(),
				password: z.string().optional(),
				apiKeyName: z.string().optional(),
				apiKeyValue: z.string().optional(),
				apiKeyIn: z.enum(["header", "query"]).optional(),
			})
			.default({}),
		language: z.enum(["curl", "fetch", "axios", "python"]).default("curl"),
		environmentId: z.string().optional(),
	})
	.strict();

export async function generateSnippet(request, response, next) {
	try {
		const data = snippetSchema.parse(request.body);

		let envVariables = [];
		if (data.environmentId) {
			const env = await environmentRepository.findById(data.environmentId, request.account._id);
			if (env) envVariables = env.variables;
		} else {
			const envs = await environmentRepository.findAllByAccount(request.account._id);
			const active = envs.find((e) => e.isActive);
			if (active) envVariables = active.variables;
		}

		const snippet = snippetService.generate(data, envVariables, data.language);
		response.json({ data: { snippet, language: data.language } });
	} catch (error) {
		next(error);
	}
}

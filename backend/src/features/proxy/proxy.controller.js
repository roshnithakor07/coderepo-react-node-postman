import { z } from "zod";
import { proxyService } from "./proxy.service.js";
import { environmentRepository } from "../environments/environment.repository.js";

const headerParamSchema = z.object({ key: z.string(), value: z.string(), enabled: z.boolean().default(true) });

const authSchema = z.object({
	type: z.enum(["none", "bearer", "basic", "apikey"]).default("none"),
	token: z.string().optional(),
	username: z.string().optional(),
	password: z.string().optional(),
	apiKeyName: z.string().optional(),
	apiKeyValue: z.string().optional(),
	apiKeyIn: z.enum(["header", "query"]).optional(),
});

const proxySchema = z
	.object({
		method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
		url: z.string().min(1).max(2048),
		headers: z.array(headerParamSchema).default([]),
		params: z.array(headerParamSchema).default([]),
		body: z.string().default(""),
		bodyType: z.enum(["none", "json", "form", "text", "xml"]).default("none"),
		auth: authSchema.default({}),
		environmentId: z.string().optional(),
	})
	.strict();

export async function sendRequest(request, response, next) {
	try {
		const data = proxySchema.parse(request.body);

		let envVariables = [];
		if (data.environmentId) {
			const env = await environmentRepository.findById(data.environmentId, request.account._id);
			if (env) envVariables = env.variables;
		} else {
			const envs = await environmentRepository.findAllByAccount(request.account._id);
			const active = envs.find((e) => e.isActive);
			if (active) envVariables = active.variables;
		}

		const result = await proxyService.execute(request.account._id, data, envVariables);
		response.json({ data: result });
	} catch (error) {
		next(error);
	}
}

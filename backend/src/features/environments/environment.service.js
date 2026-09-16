import { AppError } from "../../shared/errors/app-error.js";
import { environmentRepository } from "./environment.repository.js";

export const environmentService = {
	async list(accountId) {
		return environmentRepository.findAllByAccount(accountId);
	},

	async create(accountId, data) {
		if (data.isActive) await environmentRepository.deactivateAll(accountId);
		return environmentRepository.create({ ...data, accountId });
	},

	async update(id, accountId, data) {
		if (data.isActive) await environmentRepository.deactivateAll(accountId);
		const env = await environmentRepository.update(id, accountId, data);
		if (!env) throw new AppError(404, "NOT_FOUND", "Environment not found.");
		return env;
	},

	async activate(id, accountId) {
		await environmentRepository.deactivateAll(accountId);
		const env = await environmentRepository.update(id, accountId, { isActive: true });
		if (!env) throw new AppError(404, "NOT_FOUND", "Environment not found.");
		return env;
	},

	async remove(id, accountId) {
		const env = await environmentRepository.remove(id, accountId);
		if (!env) throw new AppError(404, "NOT_FOUND", "Environment not found.");
		return env;
	},
};

import { AppError } from "../../shared/errors/app-error.js";
import { historyRepository } from "./history.repository.js";

export const historyService = {
	async list(accountId) {
		return historyRepository.findAllByAccount(accountId, 100);
	},

	async record(accountId, data) {
		return historyRepository.create({ ...data, accountId });
	},

	async remove(id, accountId) {
		const entry = await historyRepository.removeById(id, accountId);
		if (!entry) throw new AppError(404, "NOT_FOUND", "History entry not found.");
		return entry;
	},

	async clear(accountId) {
		return historyRepository.clearAll(accountId);
	},
};

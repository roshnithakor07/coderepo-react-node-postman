import { AppError } from "../../shared/errors/app-error.js";
import { collectionRepository } from "./collection.repository.js";

export const collectionService = {
	async list(accountId) {
		const collections = await collectionRepository.findAllByAccount(accountId);
		const requests = await Promise.all(collections.map((c) => collectionRepository.findRequestsByCollection(c._id, accountId)));
		return collections.map((collection, index) => ({ ...collection, requests: requests[index] }));
	},

	async create(accountId, data) {
		return collectionRepository.create({ ...data, accountId });
	},

	async update(id, accountId, data) {
		const collection = await collectionRepository.update(id, accountId, data);
		if (!collection) throw new AppError(404, "NOT_FOUND", "Collection not found.");
		return collection;
	},

	async remove(id, accountId) {
		const collection = await collectionRepository.remove(id, accountId);
		if (!collection) throw new AppError(404, "NOT_FOUND", "Collection not found.");
		await collectionRepository.removeRequestsByCollection(id, accountId);
		return collection;
	},

	async createRequest(collectionId, accountId, data) {
		const collection = await collectionRepository.findById(collectionId, accountId);
		if (!collection) throw new AppError(404, "NOT_FOUND", "Collection not found.");
		return collectionRepository.createRequest({ ...data, collectionId, accountId });
	},

	async updateRequest(id, accountId, data) {
		const req = await collectionRepository.updateRequest(id, accountId, data);
		if (!req) throw new AppError(404, "NOT_FOUND", "Request not found.");
		return req;
	},

	async removeRequest(id, accountId) {
		const req = await collectionRepository.removeRequest(id, accountId);
		if (!req) throw new AppError(404, "NOT_FOUND", "Request not found.");
		return req;
	},
};

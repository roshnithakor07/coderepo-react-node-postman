import { AppError } from "../../shared/errors/app-error.js";
import { normalizeRequestName } from "./request-name.js";
import { collectionRepository } from "./collection.repository.js";

function duplicateNameError(name) {
	return new AppError(409, "DUPLICATE_NAME", `A request named "${String(name).trim()}" already exists in this collection.`);
}

// Rejects a name already used by another request in the collection (trimmed,
// case-insensitive). `exceptId` is the request being renamed, so keeping its
// own name — or changing only its case — never conflicts with itself.
async function assertNameAvailable(collectionId, accountId, name, exceptId) {
	const key = normalizeRequestName(name);
	const siblings = await collectionRepository.findRequestsByCollection(collectionId, accountId);
	if (siblings.some((r) => String(r._id) !== String(exceptId) && normalizeRequestName(r.name) === key)) throw duplicateNameError(name);
}

// Two simultaneous writes can both pass assertNameAvailable; the unique
// index then rejects the second one, reported the same way.
async function withDuplicateNameGuard(name, write) {
	try {
		return await write();
	} catch (error) {
		if (error?.code === 11000) throw duplicateNameError(name);
		throw error;
	}
}

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
		const { afterRequestId, ...fields } = data;
		await assertNameAvailable(collectionId, accountId, fields.name);
		if (!afterRequestId)
			return withDuplicateNameGuard(fields.name, () => collectionRepository.createRequest({ ...fields, collectionId, accountId }));

		// Place the new request directly after `afterRequestId`: renumber the
		// collection 0..n in its current display order, leaving a gap right
		// after the original, and create into that gap. Renumbering (rather
		// than a fractional insert) also resolves the ties between requests
		// that were all created with the default sortOrder of 0.
		const siblings = await collectionRepository.findRequestsByCollection(collectionId, accountId);
		const index = siblings.findIndex((r) => String(r._id) === afterRequestId);
		if (index === -1) throw new AppError(400, "INVALID_POSITION", "afterRequestId must be a saved request in the same collection.");
		await collectionRepository.setRequestSortOrders(
			accountId,
			siblings.map((r, i) => ({ id: r._id, sortOrder: i <= index ? i : i + 1 })),
		);
		return withDuplicateNameGuard(fields.name, () =>
			collectionRepository.createRequest({ ...fields, collectionId, accountId, sortOrder: index + 1 }),
		);
	},

	async updateRequest(id, accountId, data) {
		if (data.name !== undefined) {
			const existing = await collectionRepository.findRequestById(id, accountId);
			if (!existing) throw new AppError(404, "NOT_FOUND", "Request not found.");
			await assertNameAvailable(existing.collectionId, accountId, data.name, id);
		}
		const req = await withDuplicateNameGuard(data.name, () => collectionRepository.updateRequest(id, accountId, data));
		if (!req) throw new AppError(404, "NOT_FOUND", "Request not found.");
		return req;
	},

	async removeRequest(id, accountId) {
		const req = await collectionRepository.removeRequest(id, accountId);
		if (!req) throw new AppError(404, "NOT_FOUND", "Request not found.");
		return req;
	},
};

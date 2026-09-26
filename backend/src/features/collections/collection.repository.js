import { Collection, SavedRequest } from "./collection.model.js";
import { normalizeRequestName } from "./request-name.js";

export const collectionRepository = {
	async findAllByAccount(accountId) {
		return Collection.find({ accountId }).sort({ sortOrder: 1, createdAt: -1 }).lean();
	},
	async findById(id, accountId) {
		return Collection.findOne({ _id: id, accountId }).lean();
	},
	async create(data) {
		const collection = await Collection.create(data);
		return collection.toObject();
	},
	async update(id, accountId, data) {
		return Collection.findOneAndUpdate({ _id: id, accountId }, { $set: data }, { new: true, runValidators: true }).lean();
	},
	async remove(id, accountId) {
		return Collection.findOneAndDelete({ _id: id, accountId }).lean();
	},

	async findRequestsByCollection(collectionId, accountId) {
		return SavedRequest.find({ collectionId, accountId }).sort({ sortOrder: 1, createdAt: -1 }).lean();
	},
	async findRequestById(id, accountId) {
		return SavedRequest.findOne({ _id: id, accountId }).lean();
	},
	async createRequest(data) {
		const req = await SavedRequest.create(data);
		return req.toObject();
	},
	async updateRequest(id, accountId, data) {
		// findOneAndUpdate skips document hooks, so keep nameKey in sync here.
		const set = data.name === undefined ? data : { ...data, nameKey: normalizeRequestName(data.name) };
		return SavedRequest.findOneAndUpdate({ _id: id, accountId }, { $set: set }, { new: true, runValidators: true }).lean();
	},
	async removeRequest(id, accountId) {
		return SavedRequest.findOneAndDelete({ _id: id, accountId }).lean();
	},
	async setRequestSortOrders(accountId, orders) {
		if (orders.length === 0) return;
		await SavedRequest.bulkWrite(
			orders.map(({ id, sortOrder }) => ({ updateOne: { filter: { _id: id, accountId }, update: { $set: { sortOrder } } } })),
		);
	},
	async removeRequestsByCollection(collectionId, accountId) {
		return SavedRequest.deleteMany({ collectionId, accountId });
	},
};

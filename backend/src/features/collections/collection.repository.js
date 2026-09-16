import { Collection, SavedRequest } from "./collection.model.js";

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
		return SavedRequest.findOneAndUpdate({ _id: id, accountId }, { $set: data }, { new: true, runValidators: true }).lean();
	},
	async removeRequest(id, accountId) {
		return SavedRequest.findOneAndDelete({ _id: id, accountId }).lean();
	},
	async removeRequestsByCollection(collectionId, accountId) {
		return SavedRequest.deleteMany({ collectionId, accountId });
	},
};

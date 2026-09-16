import { History } from "./history.model.js";

export const historyRepository = {
	async findAllByAccount(accountId, limit = 100) {
		return History.find({ accountId }).sort({ createdAt: -1 }).limit(limit).lean();
	},
	async findById(id, accountId) {
		return History.findOne({ _id: id, accountId }).lean();
	},
	async create(data) {
		const entry = await History.create(data);
		return entry.toObject();
	},
	async removeById(id, accountId) {
		return History.findOneAndDelete({ _id: id, accountId }).lean();
	},
	async clearAll(accountId) {
		return History.deleteMany({ accountId });
	},
};

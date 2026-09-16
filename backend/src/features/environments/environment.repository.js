import { Environment } from "./environment.model.js";

export const environmentRepository = {
	async findAllByAccount(accountId) {
		return Environment.find({ accountId }).sort({ createdAt: -1 }).lean();
	},
	async findById(id, accountId) {
		return Environment.findOne({ _id: id, accountId }).lean();
	},
	async create(data) {
		const env = await Environment.create(data);
		return env.toObject();
	},
	async update(id, accountId, data) {
		return Environment.findOneAndUpdate({ _id: id, accountId }, { $set: data }, { new: true, runValidators: true }).lean();
	},
	async deactivateAll(accountId) {
		return Environment.updateMany({ accountId }, { $set: { isActive: false } });
	},
	async remove(id, accountId) {
		return Environment.findOneAndDelete({ _id: id, accountId }).lean();
	},
};

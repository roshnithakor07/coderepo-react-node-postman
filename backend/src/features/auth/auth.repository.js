import { WorkspaceAccount } from "./workspace-account.model.js";

export const authRepository = {
	async findActiveByEmailWithPassword(email) {
		return WorkspaceAccount.findOne({ email, active: true }).select("+passwordHash").lean();
	},
	async findActiveById(id) {
		return WorkspaceAccount.findOne({ _id: id, active: true }).lean();
	},
};

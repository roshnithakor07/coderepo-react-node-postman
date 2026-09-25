import { History } from "./history.model.js";

const SUMMARY_FIELDS = "method url status responseTime responseSize createdAt";

export const historyRepository = {
	// Cursor-paginated, summary-projected list: never pulls request/response
	// bodies or headers off the wire for a list call. `cursor`, when present,
	// is { createdAt, id } of the last item from the previous page — sorting
	// and filtering both use (createdAt, _id) together as a compound key so
	// entries sharing the exact same createdAt millisecond (a real
	// possibility, not just a theoretical one) still paginate without
	// skipping or repeating a row. Fetches `limit + 1` so "is there another
	// page" is a plain length check, no second COUNT query.
	async findSummaryPage(accountId, { limit = 50, cursor = null } = {}) {
		const filter = { accountId };
		if (cursor) {
			filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }];
		}
		const rows = await History.find(filter)
			.select(SUMMARY_FIELDS)
			.sort({ createdAt: -1, _id: -1 })
			.limit(limit + 1)
			.lean();
		const hasMore = rows.length > limit;
		const items = hasMore ? rows.slice(0, limit) : rows;
		return { items, hasMore };
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

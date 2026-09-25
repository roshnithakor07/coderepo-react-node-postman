import { AppError } from "../../shared/errors/app-error.js";
import { historyRepository } from "./history.repository.js";

const MAX_STORED_BODY_LENGTH = 1024 * 1024; // 1 MB — see transcripts/02-design-decisions.md

function truncateBody(body) {
	if (typeof body !== "string" || body.length <= MAX_STORED_BODY_LENGTH) return { body: body || "", truncated: false };
	return { body: body.slice(0, MAX_STORED_BODY_LENGTH), truncated: true };
}

// Opaque cursor = last row's (createdAt, _id), base64-encoded so callers never
// need to know or reconstruct its shape. Kept in the service layer (not the
// repository) because it's a pagination-protocol concern, not a query concern.
function encodeCursor(entry) {
	return Buffer.from(JSON.stringify({ t: entry.createdAt.toISOString(), id: String(entry._id) })).toString("base64url");
}

function decodeCursor(raw) {
	if (!raw) return null;
	try {
		const { t, id } = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
		return { createdAt: new Date(t), id };
	} catch {
		throw new AppError(400, "INVALID_CURSOR", "History pagination cursor is invalid.");
	}
}

export const historyService = {
	async list(accountId, { limit, cursor } = {}) {
		const { items, hasMore } = await historyRepository.findSummaryPage(accountId, { limit, cursor: decodeCursor(cursor) });
		return { items, nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : null };
	},

	async getById(id, accountId) {
		const entry = await historyRepository.findById(id, accountId);
		if (!entry) throw new AppError(404, "NOT_FOUND", "History entry not found.");
		return entry;
	},

	async record(accountId, data) {
		// responseSize keeps reflecting the real, untruncated size (still
		// useful in the list view) — only the persisted body text itself is
		// capped, so one oversized entry can't blow the DB (or, previously,
		// the list API's payload) up the way it did before this change.
		const request = truncateBody(data.requestBody);
		const response = truncateBody(data.responseBody);
		return historyRepository.create({
			...data,
			accountId,
			requestBody: request.body,
			requestBodyTruncated: request.truncated,
			responseBody: response.body,
			responseBodyTruncated: response.truncated,
		});
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

import { historyService } from "./history.service.js";

export async function listHistory(request, response, next) {
	try {
		const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 100);
		const data = await historyService.list(request.account._id, { limit, cursor: request.query.cursor || null });
		response.json({ data });
	} catch (error) {
		next(error);
	}
}

export async function getHistoryEntry(request, response, next) {
	try {
		response.json({ data: await historyService.getById(request.params.id, request.account._id) });
	} catch (error) {
		next(error);
	}
}

export async function deleteHistoryEntry(request, response, next) {
	try {
		await historyService.remove(request.params.id, request.account._id);
		response.status(204).end();
	} catch (error) {
		next(error);
	}
}

export async function clearHistory(request, response, next) {
	try {
		await historyService.clear(request.account._id);
		response.status(204).end();
	} catch (error) {
		next(error);
	}
}

import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
	{
		accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceAccount", required: true },
		method: { type: String, required: true, maxlength: 20 },
		url: { type: String, required: true, maxlength: 2048 },
		status: { type: Number },
		responseTime: { type: Number },
		requestHeaders: { type: mongoose.Schema.Types.Mixed, default: {} },
		requestBody: { type: String, default: "" },
		requestBodyTruncated: { type: Boolean, default: false },
		responseHeaders: { type: mongoose.Schema.Types.Mixed, default: {} },
		responseBody: { type: String, default: "" },
		responseBodyTruncated: { type: Boolean, default: false },
		responseSize: { type: Number, default: 0 },
		error: { type: String, default: null },
	},
	{ timestamps: true, versionKey: false },
);

// accountId first (the equality filter every query uses), then createdAt/_id
// descending together — that compound shape is what makes the cursor-paginated
// list query (see history.repository.js#findSummaryPage) a single index scan
// instead of an index scan on createdAt followed by an in-memory sort on _id.
historySchema.index({ accountId: 1, createdAt: -1, _id: -1 });

export const History = mongoose.model("History", historySchema);

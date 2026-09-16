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
		responseHeaders: { type: mongoose.Schema.Types.Mixed, default: {} },
		responseBody: { type: String, default: "" },
		responseSize: { type: Number, default: 0 },
		error: { type: String, default: null },
	},
	{ timestamps: true, versionKey: false },
);

historySchema.index({ accountId: 1, createdAt: -1 });

export const History = mongoose.model("History", historySchema);

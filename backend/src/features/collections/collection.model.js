import mongoose from "mongoose";

const headerSchema = new mongoose.Schema(
	{ key: String, value: String, enabled: { type: Boolean, default: true }, description: { type: String, maxlength: 500 } },
	{ _id: false },
);
const paramSchema = new mongoose.Schema(
	{ key: String, value: String, enabled: { type: Boolean, default: true }, description: { type: String, maxlength: 500 } },
	{ _id: false },
);

const savedRequestSchema = new mongoose.Schema(
	{
		collectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Collection", required: true },
		accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceAccount", required: true },
		name: { type: String, required: true, trim: true, maxlength: 200 },
		method: { type: String, required: true, enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"], default: "GET" },
		url: { type: String, default: "", maxlength: 2048 },
		headers: { type: [headerSchema], default: [] },
		params: { type: [paramSchema], default: [] },
		body: { type: String, default: "" },
		bodyType: { type: String, enum: ["none", "json", "form", "text", "xml"], default: "none" },
		auth: {
			type: { type: String, enum: ["none", "bearer", "basic", "apikey"], default: "none" },
			token: String,
			username: String,
			password: String,
			apiKeyName: String,
			apiKeyValue: String,
			apiKeyIn: { type: String, enum: ["header", "query"], default: "header" },
		},
		description: { type: String, default: "", maxlength: 1000 },
		sortOrder: { type: Number, default: 0 },
	},
	{ timestamps: true, versionKey: false },
);

const collectionSchema = new mongoose.Schema(
	{
		accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceAccount", required: true },
		name: { type: String, required: true, trim: true, maxlength: 200 },
		description: { type: String, default: "", maxlength: 1000 },
		sortOrder: { type: Number, default: 0 },
	},
	{ timestamps: true, versionKey: false },
);

collectionSchema.index({ accountId: 1, createdAt: -1 });
savedRequestSchema.index({ collectionId: 1, sortOrder: 1 });
savedRequestSchema.index({ accountId: 1 });

export const Collection = mongoose.model("Collection", collectionSchema);
export const SavedRequest = mongoose.model("SavedRequest", savedRequestSchema);

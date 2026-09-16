import mongoose from "mongoose";

const variableSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, trim: true, maxlength: 200 },
		value: { type: String, default: "" },
		enabled: { type: Boolean, default: true },
	},
	{ _id: false },
);

const environmentSchema = new mongoose.Schema(
	{
		accountId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceAccount", required: true },
		name: { type: String, required: true, trim: true, maxlength: 200 },
		isActive: { type: Boolean, default: false },
		variables: { type: [variableSchema], default: [] },
	},
	{ timestamps: true, versionKey: false },
);

environmentSchema.index({ accountId: 1, isActive: 1 });

export const Environment = mongoose.model("Environment", environmentSchema);

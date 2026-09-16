import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { authRouter } from "./features/auth/auth.routes.js";
import { collectionRouter, savedRequestRouter } from "./features/collections/collection.routes.js";
import { environmentRouter } from "./features/environments/environment.routes.js";
import { historyRouter } from "./features/history/history.routes.js";
import { proxyRouter } from "./features/proxy/proxy.routes.js";
import { snippetRouter } from "./features/snippets/snippet.routes.js";
import { requireAuth } from "./shared/middleware/auth.js";
import { errorHandler, notFoundHandler } from "./shared/middleware/error-handler.js";

export function createApp() {
	const app = express();
	app.disable("x-powered-by");
	app.use(cors());
	app.use(express.json({ limit: "2mb" }));

	app.get("/api/v1/health", (request, response) => {
		const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
		response.status(database === "connected" ? 200 : 503).json({ data: { status: database === "connected" ? "ok" : "degraded", database } });
	});

	app.use("/api/v1/auth", authRouter);

	app.use("/api/v1", requireAuth);
	app.use("/api/v1/proxy", proxyRouter);
	app.use("/api/v1/collections", collectionRouter);
	app.use("/api/v1/requests", savedRequestRouter);
	app.use("/api/v1/environments", environmentRouter);
	app.use("/api/v1/history", historyRouter);
	app.use("/api/v1/snippets", snippetRouter);

	app.use(notFoundHandler);
	app.use(errorHandler);
	return app;
}

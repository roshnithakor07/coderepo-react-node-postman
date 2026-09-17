import express, { Router } from "express";
import {
	echoGet,
	echoWrite,
	echoDelete,
	statusCode,
	responseHeaders,
	delay,
	bearerAuth,
	basicAuth,
	listPosts,
	getPost,
	createPost,
	updatePost,
	deletePost,
	postComments,
	listUsers,
} from "./sandbox.controller.js";

// Local stand-in for a public HTTP testing service (like httpbin.org or a
// sample REST API), so the bundled example requests, history, and auth demos
// work without any internet access. It mirrors third-party test targets, not
// the Postman app's own data, so it is intentionally public and unauthenticated,
// and it has no direct frontend caller — the request builder reaches it the same
// way it reaches any external API: through the proxy engine's outbound HTTP call.
export const sandboxRouter = Router();

sandboxRouter.use((request, response, next) => {
	const contentType = request.get("content-type") || "";
	if (contentType.includes("json")) return next();
	express.text({ type: () => true, limit: "2mb" })(request, response, next);
});

sandboxRouter.get("/get", echoGet);
sandboxRouter.post("/post", echoWrite);
sandboxRouter.put("/put", echoWrite);
sandboxRouter.patch("/patch", echoWrite);
sandboxRouter.delete("/delete", echoDelete);
sandboxRouter.get("/status/:code", statusCode);
sandboxRouter.get("/response-headers", responseHeaders);
sandboxRouter.get("/delay/:seconds", delay);
sandboxRouter.get("/bearer", bearerAuth);
sandboxRouter.get("/basic-auth/:user/:pass", basicAuth);
sandboxRouter.get("/posts", listPosts);
sandboxRouter.get("/posts/:id", getPost);
sandboxRouter.post("/posts", createPost);
sandboxRouter.put("/posts/:id", updatePost);
sandboxRouter.delete("/posts/:id", deletePost);
sandboxRouter.get("/posts/:id/comments", postComments);
sandboxRouter.get("/users", listUsers);

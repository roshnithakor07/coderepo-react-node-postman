import { Router } from "express";
import {
	listCollections,
	createCollection,
	updateCollection,
	deleteCollection,
	createRequest,
	updateRequest,
	deleteRequest,
} from "./collection.controller.js";

export const collectionRouter = Router();
collectionRouter.get("/", listCollections);
collectionRouter.post("/", createCollection);
collectionRouter.put("/:id", updateCollection);
collectionRouter.delete("/:id", deleteCollection);
collectionRouter.post("/:id/requests", createRequest);

export const savedRequestRouter = Router();
savedRequestRouter.put("/:id", updateRequest);
savedRequestRouter.delete("/:id", deleteRequest);

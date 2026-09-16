import { Router } from "express";
import { listEnvironments, createEnvironment, updateEnvironment, activateEnvironment, deleteEnvironment } from "./environment.controller.js";

export const environmentRouter = Router();
environmentRouter.get("/", listEnvironments);
environmentRouter.post("/", createEnvironment);
environmentRouter.put("/:id", updateEnvironment);
environmentRouter.post("/:id/activate", activateEnvironment);
environmentRouter.delete("/:id", deleteEnvironment);

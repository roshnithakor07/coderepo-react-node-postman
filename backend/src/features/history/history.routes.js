import { Router } from "express";
import { listHistory, deleteHistoryEntry, clearHistory } from "./history.controller.js";

export const historyRouter = Router();
historyRouter.get("/", listHistory);
historyRouter.delete("/", clearHistory);
historyRouter.delete("/:id", deleteHistoryEntry);

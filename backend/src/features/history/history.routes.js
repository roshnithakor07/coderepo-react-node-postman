import { Router } from "express";
import { listHistory, getHistoryEntry, deleteHistoryEntry, clearHistory } from "./history.controller.js";

export const historyRouter = Router();
historyRouter.get("/", listHistory);
historyRouter.get("/:id", getHistoryEntry);
historyRouter.delete("/", clearHistory);
historyRouter.delete("/:id", deleteHistoryEntry);

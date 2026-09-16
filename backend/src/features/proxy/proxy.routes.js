import { Router } from "express";
import { sendRequest } from "./proxy.controller.js";

export const proxyRouter = Router();
proxyRouter.post("/", sendRequest);

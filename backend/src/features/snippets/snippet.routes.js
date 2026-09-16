import { Router } from "express";
import { generateSnippet } from "./snippet.controller.js";

export const snippetRouter = Router();
snippetRouter.post("/", generateSnippet);

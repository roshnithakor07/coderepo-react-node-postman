import { describe, test, expect } from "bun:test";
import { ZodError, z } from "zod";
import { AppError } from "../errors/app-error.js";
import { errorHandler } from "./error-handler.js";

function fakeResponse() {
	const res = { statusCode: null, body: null };
	res.status = (code) => {
		res.statusCode = code;
		return res;
	};
	res.json = (payload) => {
		res.body = payload;
		return res;
	};
	return res;
}

describe("errorHandler", () => {
	test("ZodError still returns 400 VALIDATION_ERROR (regression)", () => {
		const res = fakeResponse();
		let zodError;
		try {
			z.object({ name: z.string() }).parse({});
		} catch (error) {
			zodError = error;
		}
		expect(zodError).toBeInstanceOf(ZodError);

		errorHandler(zodError, {}, res, () => {});

		expect(res.statusCode).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
		expect(res.body.error.details).toBeDefined();
	});

	test("AppError still returns its own status/code (regression)", () => {
		const res = fakeResponse();
		const error = new AppError(404, "NOT_FOUND", "Collection not found.");

		errorHandler(error, {}, res, () => {});

		expect(res.statusCode).toBe(404);
		expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Collection not found.", details: undefined } });
	});

	test("malformed JSON body-parser error returns 400 INVALID_JSON", () => {
		const res = fakeResponse();
		const error = new SyntaxError("Unexpected token o in JSON at position 1");
		error.type = "entity.parse.failed";
		error.status = 400;
		error.body = "{oops";

		errorHandler(error, {}, res, () => {});

		expect(res.statusCode).toBe(400);
		expect(res.body.error.code).toBe("INVALID_JSON");
		expect(res.body.error.message).not.toContain("oops");
	});

	test("Mongoose CastError for an invalid ObjectId returns 400 INVALID_ID", () => {
		const res = fakeResponse();
		const error = new Error('Cast to ObjectId failed for value "not-an-id" (type string) at path "_id"');
		error.name = "CastError";
		error.kind = "ObjectId";
		error.path = "_id";
		error.value = "not-an-id";

		errorHandler(error, {}, res, () => {});

		expect(res.statusCode).toBe(400);
		expect(res.body.error.code).toBe("INVALID_ID");
		expect(res.body.error.message).toContain("_id");
	});

	test("a CastError not caused by an ObjectId still falls through to 500 (no over-broad catch)", () => {
		const res = fakeResponse();
		const error = new Error("Cast to Number failed");
		error.name = "CastError";
		error.kind = "Number";

		const originalConsoleError = console.error;
		console.error = () => {};
		try {
			errorHandler(error, {}, res, () => {});
		} finally {
			console.error = originalConsoleError;
		}

		expect(res.statusCode).toBe(500);
		expect(res.body.error.code).toBe("INTERNAL_ERROR");
	});

	test("an unexpected error still returns generic 500 with no internal detail leaked (regression)", () => {
		const res = fakeResponse();
		const error = new Error("some internal secret detail");

		const originalConsoleError = console.error;
		console.error = () => {};
		try {
			errorHandler(error, {}, res, () => {});
		} finally {
			console.error = originalConsoleError;
		}

		expect(res.statusCode).toBe(500);
		expect(res.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
		expect(JSON.stringify(res.body)).not.toContain("some internal secret detail");
	});
});

export const SANDBOX_POSTS = [
	{ id: 1, userId: 1, title: "Getting started with the API sandbox", body: "This sandbox mirrors a typical REST resource so you can practice GET, POST, PUT, and DELETE without leaving your machine." },
	{ id: 2, userId: 1, title: "Understanding environment variables", body: "Use {{baseUrl}} in the URL bar and switch environments from the header dropdown to point requests at a different host." },
	{ id: 3, userId: 2, title: "Debugging a failed request", body: "Check the Headers tab and the response status badge to see why a request did not behave as expected." },
	{ id: 4, userId: 2, title: "Working with query parameters", body: "Toggle rows on and off in the Params tab to see how the request URL changes before you send it." },
	{ id: 5, userId: 1, title: "Saving a request to a collection", body: "Once a request behaves the way you expect, save it into a collection so you can run it again later." },
];

export const SANDBOX_COMMENTS = [
	{ id: 1, postId: 1, name: "Priya Nair", body: "This helped me understand the request flow end to end." },
	{ id: 2, postId: 1, name: "Marcus Webb", body: "Nice to have a sandbox that doesn't need internet access." },
	{ id: 3, postId: 2, name: "Sofia Torres", body: "The {{baseUrl}} substitution makes switching environments painless." },
];

export const SANDBOX_USERS = [
	{ id: 1, name: "Priya Nair", email: "priya.nair@example.com" },
	{ id: 2, name: "Marcus Webb", email: "marcus.webb@example.com" },
];

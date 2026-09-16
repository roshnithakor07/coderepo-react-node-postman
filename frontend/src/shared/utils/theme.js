export function getTheme() {
	return localStorage.getItem("postman-theme") || "dark";
}

export function setTheme(theme) {
	localStorage.setItem("postman-theme", theme);
	document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "");
}

export function applyStoredTheme() {
	const theme = getTheme();
	if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
}

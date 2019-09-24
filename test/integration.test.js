const fs = require("fs");
const path = require("path");
const files = fs.readdirSync(path.resolve(__dirname, "./integration"));

describe("integration", () => {
	files.forEach(file => {
		describe(file, require(path.resolve(__dirname, "./integration", file)));
	});
});

module.exports = {
	restoreMocks: true,
	clearMocks: true,
	// collectCoverage: true,
	collectCoverageFrom: [
		"src/**/*.js",
	],
	coverageDirectory: "coverage",
	testRegex: /\.test\.js$/.source,
};

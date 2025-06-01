module.exports = {
	restoreMocks: true,
	clearMocks: true,
	// collectCoverage: true,
	collectCoverageFrom: [
		"src/**/*.ts",
	],
	coverageDirectory: "coverage",
	testRegex: /\.test\.ts$/.source,
	preset: "ts-jest",
	testEnvironment: "node",
};

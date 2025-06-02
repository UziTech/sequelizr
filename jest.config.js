export default {
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
	transform: {
		"\\.[jt]sx?$": ["ts-jest", {useESM: true}],
	},
	moduleNameMapper: {
		"(.+)\\.js": "$1",
	},
	extensionsToTreatAsEsm: [".ts"],
};

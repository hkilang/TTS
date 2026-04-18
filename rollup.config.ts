import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import esbuild from "rollup-plugin-esbuild";

import type { RollupOptions } from "rollup";

const isProduction = process.env["NODE_ENV"] === "production";

export default {
	input: "src/inference/worker.ts",
	output: {
		dir: "public",
		sourcemap: !isProduction,
		format: "iife",
	},
	plugins: [
		nodeResolve(),
		commonjs({
			requireReturnsDefault: "auto",
		}),
		esbuild({
			target: "es2017",
			sourceMap: !isProduction,
			minify: isProduction,
		}),
	],
} satisfies RollupOptions;

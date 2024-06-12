import { extname } from "path";

import react from "@vitejs/plugin-react-swc";
import autoprefixer from "autoprefixer";
import { csvParse, tsvParse } from "d3-dsv";
import postCSSNesting from "postcss-nesting";
import tailwindcss from "tailwindcss";
import tailwindcssNesting from "tailwindcss/nesting";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";
import { ViteMinifyPlugin } from "vite-plugin-minify";

import type { UserConfig } from "vite";

const dsvParsers: Record<string, ((input: string) => unknown) | undefined> = { ".csv": csvParse, ".tsv": tsvParse };

export default {
	base: "./",
	plugins: [
		react(),
		{
			name: "dsv-transform",
			transform(code, id) {
				const parser = dsvParsers[extname(id)];
				return parser && {
					code: `export default JSON.parse(${JSON.stringify(JSON.stringify(parser(code)))});`,
					map: { mappings: "" },
				};
			},
		},
		ViteMinifyPlugin(),
		ViteImageOptimizer(),
	],
	css: {
		postcss: {
			plugins: [
				tailwindcssNesting(postCSSNesting({ edition: "2024-02" })),
				tailwindcss(),
				autoprefixer(),
			],
		},
	},
	build: {
		outDir: "build",
		target: "ES2017",
		rollupOptions: {
			output: {
				assetFileNames: "[name].[hash].[ext]",
				chunkFileNames: "[name].[hash].js",
				entryFileNames: "[name].[hash].js",
				hashCharacters: "hex",
			},
		},
	},
} satisfies UserConfig;

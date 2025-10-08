import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import AudioPlayer from "./AudioPlayer";
import { INFERENCE_MODE_TO_LABEL, TERMINOLOGY } from "./consts";
import { normalizePauses, parse } from "./parse";
import SentenceCopy from "./SentenceCopy";

import type { Edge, StackedEdge, HakkaToneMode, SentenceComponentState } from "./types";

interface SentenceCardProps extends SentenceComponentState {
	hakkaToneMode: HakkaToneMode;
}

function stackEdges(edges: Edge[]): asserts edges is StackedEdge[] {
	// Interval Graph Coloring: Find how to schedule activities, each with the start time and end time given,
	// with the minimum number of activity rooms such that no two occur at the same time in the same room.
	let nLayers = 0;
	const layersAvailability: boolean[] = [];
	for (
		const { type, edge } of (edges as StackedEdge[])
			.flatMap(edge => [{ type: "start" as const, edge }, { type: "end" as const, edge }])
			.sort((a, b) =>
				(a.edge[a.type] - b.edge[b.type])
				// `end` must come first so that the room freed up can immediately be available for use
				|| (a.type === "start" && b.type === "end" ? 1 : a.type === "end" && b.type === "start" ? -1 : 0)
				|| ((b.edge.end - b.edge.start) - (a.edge.end - a.edge.start))
				// Not need since this is a stable sort
				// || (a.edge.start - b.edge.start)
			)
	) {
		switch (type) {
			case "start": {
				let availableLayer = layersAvailability.findIndex(x => x);
				if (availableLayer === -1) availableLayer = nLayers++;
				edge.layer = availableLayer;
				layersAvailability[availableLayer] = false;
				break;
			}
			case "end":
				layersAvailability[edge.layer] = true;
				break;
		}
	}
}

function findOptimalEdges(edges: Edge[]): Set<Edge>;
function findOptimalEdges(edges: Edge[], originalEnabledEdges: Set<Edge>, edgeToToggle: Edge, newState: boolean): Set<Edge>;
function findOptimalEdges(edges: Edge[], originalEnabledEdges?: Set<Edge>, edgeToToggle?: Edge, newState?: boolean): Set<Edge> {
	// Weighted Interval Scheduling: Find a subset of the set of non-overlapping activities, each with the
	// start time and end time given, such that the total duration of the activities is the maximum.

	// Edges are already pre-sorted by start index (If two edges start at the same index, the longer one is prioritized)
	const n = edges.length;

	function nextNonOverlapping(i: number) {
		// Should be faster than binary search since ideally the solution is the next edge most of the time
		for (let j = i + 1; j < n; j++) {
			if (edges[j].start >= edges[i].end) return j;
		}
		return n;
	}

	// Use composition for lesser memory
	interface Solution extends ReadonlyArray<Edge> {
		weight: number;
	}

	function addEdge(edges: Solution, newEdge: Edge): Solution {
		const newEdgeWeight = newEdge.end - newEdge.start;
		const newEdges = Object.assign([...edges], { weight: edges.weight + newEdgeWeight });
		let i = 0;
		while (i < newEdges.length && newEdgeWeight < newEdges[i].end - newEdges[i].start) i++;
		newEdges.splice(i, 0, newEdge);
		return newEdges;
	}

	function compareSolutions<A extends Solution, B extends Solution>(a: A, b: B): A | B {
		let diff = 0;
		if (edgeToToggle) {
			// XXX this is slow and naïve
			if (a.includes(edgeToToggle) && !b.includes(edgeToToggle)) diff = newState ? 1 : -1;
			else if (!a.includes(edgeToToggle) && b.includes(edgeToToggle)) diff = newState ? -1 : 1;
			else {
				for (const edge of a) diff += +originalEnabledEdges!.has(edge);
				for (const edge of b) diff -= +originalEnabledEdges!.has(edge);
			}
		}
		if (!diff) {
			for (let i = 0; i < Math.min(a.length, b.length); i++) {
				if ((diff = (a[i].end - a[i].start) - (b[i].end - b[i].start))) break;
			}
		}
		return (diff || (a.length - b.length) || (a.weight - b.weight)) >= 0 ? a : b;
	}

	// Dynamic Programming
	const optimal: Solution[] = [];
	optimal[n] = Object.assign([], { weight: 0 });
	for (let i = n - 1; i >= 0; i--) {
		optimal[i] = compareSolutions(
			addEdge(optimal[nextNonOverlapping(i)], edges[i]),
			optimal[i + 1],
		);
	}
	return new Set(optimal[0]);
}

function groupEdges<T extends Edge>(edges: T[], length: number) {
	// Edges are already pre-sorted by start index
	// Use composition for lesser memory
	interface EdgesWithEnd extends Array<T> {
		end: number;
	}
	const edgeGroups: EdgesWithEnd[] = [];
	let currEnd = 0;
	let currEdges: T[] = [];
	for (const edge of edges) {
		if (edge.start >= currEnd) {
			if (currEdges.length) edgeGroups.push(Object.assign(currEdges, { end: currEnd }));
			currEdges = [];
			if (edge.start > currEnd) edgeGroups.push(Object.assign([], { end: edge.start }));
		}
		currEdges.push(edge);
		if (edge.end > currEnd) currEnd = edge.end;
	}
	if (currEdges.length) edgeGroups.push(Object.assign(currEdges, { end: currEnd }));
	if (length > currEnd) edgeGroups.push(Object.assign([], { end: length }));
	return edgeGroups;
}

function replaceHakkaTones(language: string, hakkaToneMode: HakkaToneMode, pron: string) {
	return language === "hakka" && hakkaToneMode === "diacritics"
		? pron.replace(/(\D*[aeo]|\D*i(?=u\d)|\D*u(?=i\d)|\D*[iu]|\D*[mn])(\D*)(\d)/g, (_, $1, $2, $3) => $1 + " ́̄̆̀̆̀"[+$3] + $2)
		: pron;
}

export default function SentenceCard({
	sentence: { language, voice, inferenceMode, voiceSpeed, syllables },
	hakkaToneMode,
	setDownloadState,
	currSettingsDialogPage,
	setCurrSettingsDialogPage,
}: SentenceCardProps) {
	const { t } = useTranslation();
	const [enabledEdges, setEnabledEdges] = useState(new Set<Edge>());
	const edges = useMemo(() => {
		const edges = parse(language, syllables);
		setEnabledEdges(findOptimalEdges(edges));
		return edges;
	}, [language, syllables]);
	const edgeGroups = useMemo(() => {
		stackEdges(edges);
		return groupEdges(edges, syllables.length);
	}, [edges, syllables.length]);

	const enabledEdgesProns = useMemo(() => {
		const prons: string[] = [];
		let prevEnd = 0;
		for (const edge of [...enabledEdges].sort((a, b) => a.start - b.start)) {
			for (let i = prevEnd; i < edge.start; i++) prons.push(normalizePauses(syllables[i]));
			prons.push(edge.pron);
			prevEnd = edge.end;
		}
		for (let i = prevEnd; i < syllables.length; i++) prons.push(normalizePauses(syllables[i]));
		return prons;
	}, [enabledEdges, syllables]);
	const flattenedProns = useMemo(() => enabledEdgesProns.flatMap(pron => pron.split(" ")), [enabledEdgesProns]);

	let i = 0;
	const tables = edgeGroups.map((edgesInGroup, key) => {
		const start = i;

		const chars: JSX.Element[] = [];
		while (i < edgesInGroup.end) {
			chars.push(
				<ruby key={i} className="px-2 py-1">
					{syllables[i]}
					<rt>{flattenedProns[i].length > 1 ? replaceHakkaTones(language, hakkaToneMode, flattenedProns[i]) : "\xa0"}</rt>
				</ruby>,
			);
			i++;
		}

		const layers: Edge[][] = [];
		for (const edge of edgesInGroup) (layers[edge.layer] ||= []).push(edge);
		if (layers.length <= 1) return chars;

		i = start;
		const cells: JSX.Element[] = [];
		while (i < edgesInGroup.end) {
			cells.push(<td key={i} className="text-xl sm:text-2xl text-[#9a190c] px-2 py-1">{syllables[i]}</td>);
			i++;
		}

		const dropdown = <table className="text-center min-w-full" key={key}>
			<tbody>
				<tr>{cells}</tr>
				{layers.map((edgesInLayer, key) => {
					const cells: JSX.Element[] = [];
					let prev = start;
					for (const edge of edgesInLayer) {
						if (edge.start > prev) cells.push(<td key={prev} colSpan={edge.start - prev} />);
						cells.push(
							<td key={edge.start} className="p-1 align-top" colSpan={edge.end - edge.start}>
								<button
									type="button"
									className={`w-full cursor-pointer border-t-2 ${
										enabledEdges.has(edge)
											? "border-t-yellow-400 text-yellow-700 hover:border-t-yellow-300 hover:text-yellow-600"
											: "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800"
									} transition-colors px-1 align-top`}
									onClick={() => setEnabledEdges(enabledEdges => findOptimalEdges(edges, enabledEdges, edge, !enabledEdges.has(edge)))}>
									<div className="text-base sm:text-lg">{replaceHakkaTones(language, hakkaToneMode, edge.pron)}</div>
									<div className="text-xs sm:text-sm text-slate-500">{edge.note}</div>
								</button>
							</td>,
						);
						prev = edge.end;
					}
					return <tr key={key}>{cells}</tr>;
					// The final empty cell is unnecessary
				})}
			</tbody>
		</table>;

		return <div className="dropdown dropdown-hover group" key={key}>
			{/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
			<div tabIndex={0} className="text-[#0a469f] group-hover:bg-[#f7f9fd] rounded-lg transition-colors">{chars}</div>
			{/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
			<ul tabIndex={0} className="dropdown-content left-1/2 -translate-x-1/2 z-10 p-2 min-w-full shadow bg-[#fffefd] border border-base-200 rounded-box whitespace-nowrap">{dropdown}</ul>
		</div>;
	});

	return <div className="card card-bordered border-base-300 bg-base-100 rounded-xl shadow-lg mb-3">
		<div className="card-body max-sm:[--padding-card:1.5rem]">
			<div className="join">
				<span className="badge badge-primary join-item">{TERMINOLOGY[language]}</span>
				<span className="badge badge-secondary join-item">{TERMINOLOGY[voice]}</span>
				<span className="badge badge-accent join-item">{t(INFERENCE_MODE_TO_LABEL[inferenceMode])}</span>
				<span className="badge badge-info join-item">{voiceSpeed}×</span>
			</div>
			<SentenceCopy syllables={syllables} prons={flattenedProns} />
			<div className="text-2.5xl/none sm:text-4xl mt-1">{tables}</div>
			<AudioPlayer
				sentence={{ language, voice, inferenceMode, voiceSpeed, syllables: inferenceMode === "lightweight" ? enabledEdgesProns : flattenedProns }}
				setDownloadState={setDownloadState}
				currSettingsDialogPage={currSettingsDialogPage}
				setCurrSettingsDialogPage={setCurrSettingsDialogPage} />
		</div>
	</div>;
}

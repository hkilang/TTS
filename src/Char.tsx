import { useState } from "react";

import type { PronNoteArray } from "./types";

export default function Char({
	char,
	pronNoteArray,
	setSyllable,
}: {
	char: string;
	pronNoteArray: PronNoteArray;
	setSyllable: (pron: string) => void;
}) {
	const [selected, setSelected] = useState(-1);

	const resolved = selected !== -1;
	const currIndex = +resolved && selected;
	const [pron, note] = pronNoteArray[currIndex] || ["", ""];

	return pronNoteArray.length > 1
		? <div className="dropdown dropdown-hover">
			{/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
			<label className={resolved ? "text-success" : "text-error"} tabIndex={0}>
				<ruby>
					{char}
					<rt>{pron}</rt>
					<span className="-order-1 text-xs sm:text-sm text-slate-500">{note || "\xa0"}</span>
				</ruby>
			</label>
			{/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
			<ul className="dropdown-content z-10 menu p-2 shadow bg-base-100 rounded-box [display:table]" tabIndex={0}>
				{pronNoteArray.map(([pron, note], i) => (
					<button
						key={i}
						className="contents"
						onClick={() => {
							setSelected(i);
							setSyllable(pron);
						}}>
						<li className="table-row-group">
							<div className={`table-row join sm:text-lg${i === selected ? " active" : ""}`}>
								<span className="table-cell px-4 py-3 join-item whitespace-nowrap">{pron}</span>
								<span className="table-cell px-4 py-3 join-item whitespace-nowrap">{note}</span>
							</div>
						</li>
					</button>
				))}
			</ul>
		</div>
		: <ruby>
			{char}
			<rt>{pron}</rt>
			<span className="-order-1 text-xs sm:text-sm text-slate-500">{note || "\xa0"}</span>
		</ruby>;
}

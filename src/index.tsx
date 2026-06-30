import React from "react";
import { createRoot } from "react-dom/client";
import { MdClose, MdInfoOutline, MdPlayArrow } from "react-icons/md";

import "./i18n";
import App from "./App";
import "./index.css";

// Setup viewport resize handler after DOM is ready
if (visualViewport !== null && typeof window !== "undefined") {
	window.addEventListener("DOMContentLoaded", () => {
		// https://github.com/w3c/csswg-drafts/issues/7194, https://github.com/w3c/csswg-drafts/issues/7475
		const container = document.body.firstElementChild as HTMLDivElement;
		if (container && visualViewport) {
			let prevWidth = visualViewport.width;
			let prevHeight = visualViewport.height;
			visualViewport.addEventListener("resize", () => {
				if (!visualViewport || !container) return;
				const currWidth = visualViewport.width;
				const currHeight = visualViewport.height;
				container.style.transition = prevWidth === (prevWidth = currWidth) && prevHeight > (prevHeight = currHeight)
					? "height 800ms cubic-bezier(0.2, 0.8, 0.4, 1)"
					: "";
				container.style.height = `${currHeight}px`;
			});
		}
	});
}

if (typeof document !== "undefined") {
	document.addEventListener("gesturestart", event => event.preventDefault());
}

const rootElement = document.getElementById("root");
if (!rootElement) {
	console.error("Root element not found!");
}
else {
	const root = createRoot(rootElement);
	root.render(
		<React.StrictMode>
			<App />
		</React.StrictMode>,
	);
}

const CLASS_NAME_TO_ICON: Record<string, JSX.Element> = {
	"icon-info": <MdInfoOutline size="1.125em" />,
	"icon-close": <MdClose />,
	"icon-play": <MdPlayArrow />,
};

// Wait for DOM to be ready before rendering icons
if (typeof document !== "undefined") {
	window.addEventListener("DOMContentLoaded", () => {
		for (const [className, icon] of Object.entries(CLASS_NAME_TO_ICON)) {
			for (const element of document.getElementsByClassName(className)) {
				try {
					createRoot(element).render(icon);
				}
				catch (error) {
					console.error(`Error rendering icon for ${className}:`, error);
				}
			}
		}
	});
}

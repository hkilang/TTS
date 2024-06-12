import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

const aboutDialog = document.getElementById("about-dialog") as HTMLDialogElement;
document.getElementById("btn-show")!.addEventListener("click", () => {
	// https://stackoverflow.com/a/76158858
	aboutDialog.inert = true;
	aboutDialog.showModal();
	aboutDialog.inert = false;
});

createRoot(document.getElementById("root")!).render(<App />);

import { a as sendMessageToHost, r as listenHostMessages } from "../interface-BsWSTNwj.mjs";
import { getPort } from "get-port-please";
//#region src/vitest-wrapper/cli.ts
function createCustomReporter(onVitestInit) {
	let ctx = void 0;
	function getVitestUiUrl() {
		if (!ctx.config.ui) return void 0;
		return `${ctx.vite.config.server.https ? "https:" : "http:"}//${ctx.config.api.host || "localhost"}:${ctx.config.api.port}${ctx.config.uiBase}`;
	}
	function toUpdatedResult() {
		const files = ctx.state.getFiles();
		return {
			failedCount: files.filter((f) => f.result?.state === "fail").length ?? 0,
			passedCount: files.filter((f) => f.result?.state === "pass").length ?? 0,
			totalCount: files.length ?? 0
		};
	}
	function toFinishedResult() {
		return toUpdatedResult();
	}
	return {
		onInit(_ctx) {
			ctx = _ctx;
			onVitestInit(ctx);
			sendMessageToHost("started", { uiUrl: getVitestUiUrl() });
		},
		onTestRunStart() {
			sendMessageToHost("updated", toUpdatedResult());
		},
		onTestModuleCollected() {
			sendMessageToHost("updated", toUpdatedResult());
		},
		onTestCaseResult() {
			sendMessageToHost("updated", toUpdatedResult());
		},
		onTestModuleEnd() {
			sendMessageToHost("updated", toUpdatedResult());
		},
		onTestRunEnd() {
			sendMessageToHost("finished", toFinishedResult());
		}
	};
}
async function main() {
	const { apiPorts, watchMode } = await new Promise((resolve) => {
		listenHostMessages(({ type, payload }) => {
			if (type === "start") resolve(payload);
		});
	});
	const port = apiPorts ? await getPort({ ports: apiPorts }) : void 0;
	const { startVitest } = await import("vitest/node");
	const customReporter = createCustomReporter((vitest) => {
		listenHostMessages(async ({ type, payload }) => {
			if (type === "stop") {
				await vitest.exit(payload.force);
				process.exit();
			}
		});
	});
	const vitest = await startVitest("test", [], watchMode ? {
		passWithNoTests: true,
		ui: true,
		watch: true,
		open: false,
		api: { port }
	} : {
		ui: false,
		watch: false
	}, { test: { reporters: ["default", customReporter] } });
	if (!watchMode) {
		await vitest.exit();
		process.exit();
	}
}
main();
//#endregion
export {};

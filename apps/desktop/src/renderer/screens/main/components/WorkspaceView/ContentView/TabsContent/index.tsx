import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTabsStore } from "renderer/stores/tabs/store";
import { resolveActiveTabIdForWorkspace } from "renderer/stores/tabs/utils";
import { EmptyTabView } from "./EmptyTabView";
import { TabView } from "./TabView";

export function TabsContent() {
	const { workspaceId: activeWorkspaceId } = useParams({ strict: false });
	const allTabs = useTabsStore((s) => s.tabs);
	const activeTabIds = useTabsStore((s) => s.activeTabIds);
	const tabHistoryStacks = useTabsStore((s) => s.tabHistoryStacks);

	const activeTabId = useMemo(() => {
		if (!activeWorkspaceId) return null;

		const resolvedActiveTabId = resolveActiveTabIdForWorkspace({
			workspaceId: activeWorkspaceId,
			tabs: allTabs,
			activeTabIds,
			tabHistoryStacks,
		});
		if (!resolvedActiveTabId) return null;

		const tab = allTabs.find((t) => t.id === resolvedActiveTabId) || null;
		if (!tab || tab.workspaceId !== activeWorkspaceId) return null;
		return resolvedActiveTabId;
	}, [activeWorkspaceId, activeTabIds, allTabs, tabHistoryStacks]);

	const workspaceTabs = useMemo(() => {
		if (!activeWorkspaceId) return [];
		return allTabs.filter((tab) => tab.workspaceId === activeWorkspaceId);
	}, [activeWorkspaceId, allTabs]);

	return (
		<div className="flex-1 min-h-0 flex overflow-hidden">
			{workspaceTabs.length > 0 ? (
				workspaceTabs.map((tab) => (
					<div
						key={tab.id}
						className="w-full h-full"
						style={{
							display: tab.id === activeTabId ? "flex" : "none",
						}}
					>
						<TabView tab={tab} />
					</div>
				))
			) : (
				<EmptyTabView />
			)}
		</div>
	);
}

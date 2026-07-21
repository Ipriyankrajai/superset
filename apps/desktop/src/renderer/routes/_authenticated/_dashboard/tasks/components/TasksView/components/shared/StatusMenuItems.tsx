import type { SelectTaskStatus } from "@superset/db/schema";
import type { ReactNode } from "react";
import { isSameStatusName } from "../../utils/sorting";
import { StatusIcon, type StatusType } from "./StatusIcon";

interface MenuItemProps {
	children: ReactNode;
	onSelect: () => void;
	className?: string;
}

interface StatusMenuItemsProps {
	statuses: SelectTaskStatus[];
	/**
	 * Name of the task's current status. Selection is matched by name rather
	 * than id because duplicate statuses (one per Linear team) are collapsed to
	 * a single representative row before rendering, so the task's own status row
	 * may not be the one shown here — but it shares the same name.
	 */
	currentStatusName: string;
	onSelect: (status: SelectTaskStatus) => void;
	MenuItem: React.ComponentType<MenuItemProps>;
}

export function StatusMenuItems({
	statuses,
	currentStatusName,
	onSelect,
	MenuItem,
}: StatusMenuItemsProps) {
	return (
		<>
			{statuses.map((status) => {
				const isSelected = isSameStatusName(status.name, currentStatusName);
				return (
					<MenuItem
						key={status.id}
						onSelect={() => onSelect(status)}
						className="flex items-center gap-3 px-3 py-2"
					>
						<StatusIcon
							type={status.type as StatusType}
							color={status.color}
							progress={status.progressPercent ?? undefined}
						/>
						<span className="text-sm flex-1">{status.name}</span>
						{isSelected && <span className="text-sm">✓</span>}
					</MenuItem>
				);
			})}
		</>
	);
}

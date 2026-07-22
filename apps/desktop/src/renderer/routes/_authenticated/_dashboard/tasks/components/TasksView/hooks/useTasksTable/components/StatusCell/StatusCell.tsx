import type { SelectTaskStatus } from "@superset/db/schema";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@superset/ui/dropdown-menu";
import { useLiveQuery } from "@tanstack/react-db";
import { useMemo, useState } from "react";
import { useOptimisticCollectionActions } from "renderer/routes/_authenticated/hooks/useOptimisticCollectionActions";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import {
	StatusIcon,
	type StatusType,
} from "../../../../components/shared/StatusIcon";
import { StatusMenuItems } from "../../../../components/shared/StatusMenuItems";
import {
	getStatusesForTeam,
	isSameStatusName,
} from "../../../../utils/sorting";
import type { TaskWithStatus } from "../../useTasksTable";

interface StatusCellProps {
	taskWithStatus: TaskWithStatus;
}

export function StatusCell({ taskWithStatus }: StatusCellProps) {
	const collections = useCollections();
	const { tasks: taskActions } = useOptimisticCollectionActions();
	const [open, setOpen] = useState(false);

	const { data: allStatuses } = useLiveQuery(
		(q) => (open ? q.from({ taskStatuses: collections.taskStatuses }) : null),
		[collections, open],
	);

	const statuses = useMemo(() => allStatuses || [], [allStatuses]);
	const currentStatus = taskWithStatus.status;

	const sortedStatuses = useMemo(
		() => getStatusesForTeam(statuses, taskWithStatus.externalTeamId),
		[statuses, taskWithStatus.externalTeamId],
	);

	const handleSelectStatus = (newStatus: SelectTaskStatus) => {
		if (isSameStatusName(newStatus.name, currentStatus.name)) {
			setOpen(false);
			return;
		}

		const transaction = taskActions.updateStatus(
			taskWithStatus.id,
			newStatus.id,
		);
		if (transaction) {
			setOpen(false);
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="p-0 cursor-pointer border-0"
					onClick={(e) => e.stopPropagation()}
				>
					<StatusIcon
						type={currentStatus.type as StatusType}
						color={currentStatus.color}
						progress={currentStatus.progressPercent ?? undefined}
						showHover={true}
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-48 p-1"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="max-h-64 overflow-y-auto">
					<StatusMenuItems
						statuses={sortedStatuses}
						currentStatusName={currentStatus.name}
						onSelect={handleSelectStatus}
						MenuItem={DropdownMenuItem}
					/>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

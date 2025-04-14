import React, { useState } from "react";
import { Button } from "@/components/ui/buttons/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FaChevronDown,
  FaTrash,
  FaUsers,
  FaUserPlus,
  FaExclamationTriangle,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type BulkActionsMenuProps = {
  selectedCount: number;
  onDeleteSelected: () => void;
  onExportSelected: () => void;
  onAssignMembers: () => void;
  disabled?: boolean;
};

const BulkActionsMenu: React.FC<BulkActionsMenuProps> = ({
  selectedCount,
  onDeleteSelected,
  onExportSelected,
  onAssignMembers,
  disabled = false,
}) => {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleDeleteClick = () => {
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    onDeleteSelected();
    setConfirmDeleteOpen(false);
    toast.success(`${selectedCount} teams deleted successfully`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            disabled={disabled || selectedCount === 0}
          >
            Bulk Actions ({selectedCount})
            <FaChevronDown className="ml-2 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-gray-800 border-gray-700 text-white">
          <DropdownMenuItem
            onClick={onAssignMembers}
            className="cursor-pointer hover:bg-gray-700"
          >
            <FaUserPlus className="mr-2 h-4 w-4 text-blue-400" />
            Assign Members
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onExportSelected}
            className="cursor-pointer hover:bg-gray-700"
          >
            <FaUsers className="mr-2 h-4 w-4 text-green-400" />
            Export Team Data
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-gray-700" />
          <DropdownMenuItem
            onClick={handleDeleteClick}
            className="cursor-pointer hover:bg-gray-700 text-red-400"
          >
            <FaTrash className="mr-2 h-4 w-4" />
            Delete Selected Teams
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="bg-gray-900 text-white border border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex items-center">
              <FaExclamationTriangle className="mr-2 h-5 w-5" />
              Delete {selectedCount} Teams
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone. This will permanently delete the
              selected teams and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete {selectedCount} Teams
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkActionsMenu;

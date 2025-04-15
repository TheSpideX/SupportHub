import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/buttons/Button";
import { toast } from "react-hot-toast";
import { customerApi, Customer } from "@/api/customerApi";
import { FaExclamationTriangle, FaBuilding, FaPhone } from "react-icons/fa";

interface DeleteCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: Customer;
}

const DeleteCustomerModal: React.FC<DeleteCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  customer,
}) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      await customerApi.deleteCustomer(customer.id);
      toast.success("Customer deleted successfully");
      onSuccess();
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast.error(error.message || "Failed to delete customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-800 text-white border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center">
            <FaExclamationTriangle className="text-red-500 mr-2" />
            Delete Customer
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Are you sure you want to delete this customer? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <div className="flex flex-col space-y-1">
            <p className="text-white font-medium">
              {customer.firstName} {customer.lastName}
            </p>
            <p className="text-gray-300">{customer.email}</p>
            {customer.company && (
              <p className="text-gray-400 flex items-center">
                <FaBuilding className="mr-2 h-3 w-3" />
                {customer.company}
              </p>
            )}
            {customer.phone && (
              <p className="text-gray-400 flex items-center">
                <FaPhone className="mr-2 h-3 w-3" />
                {customer.phone}
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-gray-600 text-gray-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? "Deleting..." : "Delete Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteCustomerModal;

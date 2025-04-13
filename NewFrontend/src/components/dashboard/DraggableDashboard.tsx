import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { motion } from "framer-motion";
import { FaGripVertical, FaPlus, FaCog, FaTimes } from "react-icons/fa";
import { Button } from "@/components/ui/buttons/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface DraggableDashboardProps {
  children: React.ReactNode[];
  layout: string[];
  onLayoutChange: (newLayout: string[]) => void;
  availableWidgets: { id: string; title: string }[];
}

const DraggableDashboard: React.FC<DraggableDashboardProps> = ({
  children,
  layout,
  onLayoutChange,
  availableWidgets,
}) => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(layout);

  // Map children to their respective IDs in the layout
  const childrenMap = React.Children.toArray(children).reduce(
    (acc: Record<string, React.ReactNode>, child, index) => {
      const id = layout[index] || `widget-${index}`;
      acc[id] = child;
      return acc;
    },
    {}
  );

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(layout);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onLayoutChange(items);
  };

  const handleWidgetToggle = (widgetId: string) => {
    setSelectedWidgets((prev) => {
      if (prev.includes(widgetId)) {
        return prev.filter((id) => id !== widgetId);
      } else {
        return [...prev, widgetId];
      }
    });
  };

  const applyCustomization = () => {
    onLayoutChange(selectedWidgets);
    setIsCustomizing(false);
  };

  return (
    <div className="relative">
      {/* Customization controls */}
      <div className="absolute right-0 top-0 -mt-14 flex space-x-2">
        <Dialog open={isCustomizing} onOpenChange={setIsCustomizing}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="bg-gray-700/70 border-gray-600/50 text-gray-300 hover:bg-gray-600/70 hover:text-white"
            >
              <FaCog className="h-4 w-4 mr-2" />
              Customize Dashboard
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border border-gray-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>Customize Dashboard</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-400 mb-4">
                Select which widgets to display and drag to reorder them.
              </p>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {availableWidgets.map((widget) => (
                  <div key={widget.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={widget.id}
                      checked={selectedWidgets.includes(widget.id)}
                      onCheckedChange={() => handleWidgetToggle(widget.id)}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label
                      htmlFor={widget.id}
                      className="text-sm font-medium text-gray-200 cursor-pointer"
                    >
                      {widget.title}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-700">
              <Button
                variant="outline"
                onClick={() => setIsCustomizing(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={applyCustomization}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Apply Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard content */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard" direction="vertical">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-6"
            >
              {layout.map((id, index) => {
                const child = childrenMap[id];
                if (!child) return null;

                return (
                  <Draggable key={id} draggableId={id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`relative rounded-xl transition-all duration-200 ${
                          snapshot.isDragging ? "z-10 shadow-xl" : ""
                        }`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-600/70 cursor-grab transition-opacity opacity-0 group-hover:opacity-100 z-10"
                        >
                          <FaGripVertical className="h-4 w-4" />
                        </div>
                        <div className="group">{child}</div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default DraggableDashboard;

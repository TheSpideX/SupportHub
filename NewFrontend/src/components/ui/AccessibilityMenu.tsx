import React, { useState } from "react";
import { useAccessibility } from "../providers/AccessibilityProvider";
import { Button } from "@/components/ui/buttons/Button";
import {
  FaUniversalAccess,
  FaAdjust,
  FaTextHeight,
  FaWalking,
  FaTimes,
  FaKeyboard,
} from "react-icons/fa";

const AccessibilityMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    highContrast,
    toggleHighContrast,
    largeText,
    toggleLargeText,
    reducedMotion,
    toggleReducedMotion,
    screenReaderAnnounce,
  } = useAccessibility();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    screenReaderAnnounce(`Accessibility menu ${!isOpen ? "opened" : "closed"}`);
  };

  const handleHighContrastToggle = () => {
    toggleHighContrast();
    screenReaderAnnounce(
      `High contrast mode ${!highContrast ? "enabled" : "disabled"}`
    );
  };

  const handleLargeTextToggle = () => {
    toggleLargeText();
    screenReaderAnnounce(
      `Large text mode ${!largeText ? "enabled" : "disabled"}`
    );
  };

  const handleReducedMotionToggle = () => {
    toggleReducedMotion();
    screenReaderAnnounce(
      `Reduced motion mode ${!reducedMotion ? "enabled" : "disabled"}`
    );
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={toggleMenu}
        className="rounded-full w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center"
        aria-label="Accessibility options"
        aria-expanded={isOpen}
        aria-controls="accessibility-menu"
      >
        <FaUniversalAccess className="h-6 w-6" />
      </Button>

      {isOpen && (
        <div
          id="accessibility-menu"
          className="absolute bottom-16 right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 w-64"
          role="menu"
          aria-label="Accessibility options menu"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-medium">Accessibility Options</h3>
            <Button
              onClick={toggleMenu}
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
              aria-label="Close accessibility menu"
            >
              <FaTimes className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaAdjust className="h-5 w-5 text-blue-400 mr-3" />
                <span className="text-white">High Contrast</span>
              </div>
              <Button
                onClick={handleHighContrastToggle}
                variant={highContrast ? "default" : "outline"}
                size="sm"
                className={
                  highContrast ? "bg-blue-600" : "border-gray-700 text-gray-400"
                }
                aria-pressed={highContrast}
              >
                {highContrast ? "On" : "Off"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaTextHeight className="h-5 w-5 text-blue-400 mr-3" />
                <span className="text-white">Large Text</span>
              </div>
              <Button
                onClick={handleLargeTextToggle}
                variant={largeText ? "default" : "outline"}
                size="sm"
                className={
                  largeText ? "bg-blue-600" : "border-gray-700 text-gray-400"
                }
                aria-pressed={largeText}
              >
                {largeText ? "On" : "Off"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaWalking className="h-5 w-5 text-blue-400 mr-3" />
                <span className="text-white">Reduce Motion</span>
              </div>
              <Button
                onClick={handleReducedMotionToggle}
                variant={reducedMotion ? "default" : "outline"}
                size="sm"
                className={
                  reducedMotion
                    ? "bg-blue-600"
                    : "border-gray-700 text-gray-400"
                }
                aria-pressed={reducedMotion}
              >
                {reducedMotion ? "On" : "Off"}
              </Button>
            </div>

            <div className="pt-2 border-t border-gray-700">
              <div className="flex items-start mt-2">
                <FaKeyboard className="h-5 w-5 text-blue-400 mr-3 mt-0.5" />
                <div>
                  <span className="text-white text-sm font-medium">
                    Keyboard Shortcuts
                  </span>
                  <ul className="text-gray-400 text-xs mt-1 space-y-1">
                    <li>
                      <kbd className="px-1 bg-gray-800 rounded">Alt</kbd> +{" "}
                      <kbd className="px-1 bg-gray-800 rounded">C</kbd> - Toggle
                      high contrast
                    </li>
                    <li>
                      <kbd className="px-1 bg-gray-800 rounded">Alt</kbd> +{" "}
                      <kbd className="px-1 bg-gray-800 rounded">T</kbd> - Toggle
                      large text
                    </li>
                    <li>
                      <kbd className="px-1 bg-gray-800 rounded">Alt</kbd> +{" "}
                      <kbd className="px-1 bg-gray-800 rounded">M</kbd> - Toggle
                      reduced motion
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessibilityMenu;

import React, { useState } from "react";
import { Button } from "@/components/ui/buttons/Button";
import {
  FaSearch,
  FaFilter,
  FaTimes,
  FaSortAmountDown,
  FaSortAmountUp,
} from "react-icons/fa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type TeamFilterOptions = {
  search: string;
  teamTypes: string[];
  sortBy: string;
  sortDirection: "asc" | "desc";
  onlyMyTeams: boolean;
  dateRange: {
    from: string;
    to: string;
  };
};

type TeamFilterBarProps = {
  filterOptions: TeamFilterOptions;
  onFilterChange: (filters: TeamFilterOptions) => void;
  onReset: () => void;
  totalTeams: number;
  filteredTeams: number;
};

const TeamFilterBar: React.FC<TeamFilterBarProps> = ({
  filterOptions,
  onFilterChange,
  onReset,
  totalTeams,
  filteredTeams,
}) => {
  const [searchInput, setSearchInput] = useState(filterOptions.search);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Count active filters (excluding search)
  const activeFilterCount = [
    filterOptions.teamTypes.length > 0,
    filterOptions.onlyMyTeams,
    filterOptions.dateRange.from || filterOptions.dateRange.to,
  ].filter(Boolean).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...filterOptions, search: searchInput });
  };

  const handleTeamTypeToggle = (type: string) => {
    const newTypes = filterOptions.teamTypes.includes(type)
      ? filterOptions.teamTypes.filter((t) => t !== type)
      : [...filterOptions.teamTypes, type];

    onFilterChange({ ...filterOptions, teamTypes: newTypes });
  };

  const handleSortChange = (value: string) => {
    onFilterChange({ ...filterOptions, sortBy: value });
  };

  const handleSortDirectionToggle = () => {
    onFilterChange({
      ...filterOptions,
      sortDirection: filterOptions.sortDirection === "asc" ? "desc" : "asc",
    });
  };

  const handleMyTeamsToggle = () => {
    onFilterChange({
      ...filterOptions,
      onlyMyTeams: !filterOptions.onlyMyTeams,
    });
  };

  const handleDateChange = (field: "from" | "to", value: string) => {
    onFilterChange({
      ...filterOptions,
      dateRange: { ...filterOptions.dateRange, [field]: value },
    });
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 mb-4">
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 flex items-center relative"
        >
          <Input
            type="text"
            placeholder="Search teams by name or description..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="bg-gray-900 border-gray-700 text-white pr-10 w-full"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full text-gray-400 hover:text-white"
          >
            <FaSearch className="h-4 w-4" />
          </Button>
        </form>

        {/* Filter Button */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white relative"
            >
              <FaFilter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-2 bg-blue-600 text-white text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-gray-800 border-gray-700 text-white p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Filter Teams</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="h-8 text-gray-400 hover:text-white"
                >
                  <FaTimes className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-400">Team Type</Label>
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-technical"
                      checked={filterOptions.teamTypes.includes("technical")}
                      onCheckedChange={() => handleTeamTypeToggle("technical")}
                    />
                    <Label
                      htmlFor="filter-technical"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Technical Team
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-support"
                      checked={filterOptions.teamTypes.includes("support")}
                      onCheckedChange={() => handleTeamTypeToggle("support")}
                    />
                    <Label
                      htmlFor="filter-support"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Support Team
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-400">My Teams</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="filter-my-teams"
                    checked={filterOptions.onlyMyTeams}
                    onCheckedChange={handleMyTeamsToggle}
                  />
                  <Label
                    htmlFor="filter-my-teams"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Show only my teams
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-gray-400">Creation Date</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label
                      htmlFor="date-from"
                      className="text-xs text-gray-500 mb-1"
                    >
                      From
                    </Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={filterOptions.dateRange.from}
                      onChange={(e) => handleDateChange("from", e.target.value)}
                      className="bg-gray-900 border-gray-700 text-white text-sm h-8"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="date-to"
                      className="text-xs text-gray-500 mb-1"
                    >
                      To
                    </Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={filterOptions.dateRange.to}
                      onChange={(e) => handleDateChange("to", e.target.value)}
                      className="bg-gray-900 border-gray-700 text-white text-sm h-8"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 text-xs text-gray-400">
                Showing {filteredTeams} of {totalTeams} teams
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort Dropdown */}
        <div className="flex items-center space-x-2">
          <Select value={filterOptions.sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700 text-white">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="createdAt">Creation Date</SelectItem>
              <SelectItem value="memberCount">Member Count</SelectItem>
              <SelectItem value="teamType">Team Type</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSortDirectionToggle}
            className="border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
            title={
              filterOptions.sortDirection === "asc"
                ? "Sort Ascending"
                : "Sort Descending"
            }
          >
            {filterOptions.sortDirection === "asc" ? (
              <FaSortAmountUp className="h-4 w-4" />
            ) : (
              <FaSortAmountDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Active Filters */}
      {(filterOptions.search ||
        filterOptions.teamTypes.length > 0 ||
        filterOptions.onlyMyTeams ||
        filterOptions.dateRange.from ||
        filterOptions.dateRange.to) && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700">
          {filterOptions.search && (
            <Badge
              variant="secondary"
              className="bg-gray-700 text-gray-200 hover:bg-gray-600"
            >
              Search: {filterOptions.search}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-gray-400 hover:text-white"
                onClick={() => onFilterChange({ ...filterOptions, search: "" })}
              >
                <FaTimes className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filterOptions.teamTypes.map((type) => (
            <Badge
              key={type}
              variant="secondary"
              className="bg-gray-700 text-gray-200 hover:bg-gray-600"
            >
              Type: {type === "technical" ? "Technical" : "Support"}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-gray-400 hover:text-white"
                onClick={() => handleTeamTypeToggle(type)}
              >
                <FaTimes className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {filterOptions.onlyMyTeams && (
            <Badge
              variant="secondary"
              className="bg-gray-700 text-gray-200 hover:bg-gray-600"
            >
              My Teams Only
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-gray-400 hover:text-white"
                onClick={() =>
                  onFilterChange({ ...filterOptions, onlyMyTeams: false })
                }
              >
                <FaTimes className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {(filterOptions.dateRange.from || filterOptions.dateRange.to) && (
            <Badge
              variant="secondary"
              className="bg-gray-700 text-gray-200 hover:bg-gray-600"
            >
              Date:{" "}
              {filterOptions.dateRange.from
                ? new Date(filterOptions.dateRange.from).toLocaleDateString()
                : "Any"}{" "}
              to{" "}
              {filterOptions.dateRange.to
                ? new Date(filterOptions.dateRange.to).toLocaleDateString()
                : "Any"}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 ml-1 text-gray-400 hover:text-white"
                onClick={() =>
                  onFilterChange({
                    ...filterOptions,
                    dateRange: { from: "", to: "" },
                  })
                }
              >
                <FaTimes className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          <Button
            variant="link"
            size="sm"
            onClick={onReset}
            className="text-gray-400 hover:text-white text-xs h-6"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
};

export default TeamFilterBar;

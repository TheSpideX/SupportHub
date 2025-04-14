// Add this to your existing teamController.js file

/**
 * Bulk delete teams
 * @route DELETE /api/teams/bulk
 * @access Private (Admin only)
 */
exports.bulkDeleteTeams = async (req, res) => {
  try {
    const { teamIds } = req.body;

    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return res.status(400).json({ message: "Team IDs array is required" });
    }

    // Validate user has permission to delete these teams
    // For admin, allow all. For team leads, only allow their teams
    const isAdmin = req.user.role === "admin";
    let authorizedTeamIds = teamIds;

    if (!isAdmin) {
      // Get teams where user is lead
      const userTeams = await Team.find({
        _id: { $in: teamIds },
        members: {
          $elemMatch: {
            userId: req.user.id,
            role: "lead",
          },
        },
      }).select("_id");

      authorizedTeamIds = userTeams.map((team) => team._id.toString());

      if (authorizedTeamIds.length === 0) {
        return res
          .status(403)
          .json({
            message: "You do not have permission to delete any of these teams",
          });
      }
    }

    // Track results for detailed response
    const results = {
      successful: [],
      failed: [],
      unauthorized: teamIds.filter((id) => !authorizedTeamIds.includes(id)),
    };

    // Delete teams in parallel
    const deletePromises = authorizedTeamIds.map(async (teamId) => {
      try {
        const deletedTeam = await Team.findByIdAndDelete(teamId);
        if (deletedTeam) {
          results.successful.push(teamId);

          // Also delete related invitations
          await Invitation.deleteMany({ teamId });
        } else {
          results.failed.push({ id: teamId, reason: "Team not found" });
        }
      } catch (error) {
        results.failed.push({ id: teamId, reason: error.message });
      }
    });

    await Promise.all(deletePromises);

    return res.status(200).json({
      message: `Successfully deleted ${results.successful.length} teams`,
      results,
    });
  } catch (error) {
    console.error("Bulk delete teams error:", error);
    return res
      .status(500)
      .json({ message: "Server error during bulk delete operation" });
  }
};

/**
 * Get all teams with advanced filtering
 * @route GET /api/teams
 * @access Private
 */
exports.getTeamsWithFilters = async (req, res) => {
  try {
    // Extract filter parameters from query string
    const {
      search,
      teamTypes,
      onlyMyTeams,
      fromDate,
      toDate,
      sortBy = "name",
      sortOrder = "asc",
      page = 1,
      limit = 20,
    } = req.query;

    // Build filter object
    const filter = {};

    // Search filter (name or description)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Team type filter
    if (teamTypes) {
      const types = teamTypes.split(",");
      if (types.length > 0) {
        filter.teamType = { $in: types };
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        filter.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        // Add one day to include the end date
        const endDate = new Date(toDate);
        endDate.setDate(endDate.getDate() + 1);
        filter.createdAt.$lte = endDate;
      }
    }

    // My teams filter
    if (onlyMyTeams === "true") {
      filter["members.userId"] = req.user.id;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const teams = await Team.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("members.userId", "name email")
      .exec();

    // Get total count for pagination
    const totalCount = await Team.countDocuments(filter);

    return res.status(200).json({
      teams,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get teams with filters error:", error);
    return res
      .status(500)
      .json({ message: "Server error while fetching teams" });
  }
};

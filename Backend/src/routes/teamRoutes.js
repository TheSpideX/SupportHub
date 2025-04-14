const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const teamMemberController = require("../controllers/teamMemberController");
const auth = require("../middleware/auth");

// Team CRUD operations
router.get("/", auth, teamController.getTeamsWithFilters); // Use the new filtered endpoint
router.post("/", auth, teamController.createTeam);
router.get("/:id", auth, teamController.getTeamById);
router.put("/:id", auth, teamController.updateTeam);
router.delete("/:id", auth, teamController.deleteTeam);

// Team member operations
router.post("/:id/members", auth, teamMemberController.addTeamMember);
router.delete(
  "/:id/members/:memberId",
  auth,
  teamMemberController.removeTeamMember
);
router.put("/:id/lead", auth, teamMemberController.changeTeamLead);

// Bulk operations
router.delete("/bulk", auth, teamController.bulkDeleteTeams);
router.post("/members/bulk", auth, teamMemberController.bulkAddMembers);

// Export the router
module.exports = router;

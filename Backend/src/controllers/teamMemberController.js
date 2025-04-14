// Add this to your existing teamMemberController.js file

/**
 * Bulk add members to teams
 * @route POST /api/teams/members/bulk
 * @access Private (Admin or Team Lead)
 */
exports.bulkAddMembers = async (req, res) => {
  try {
    const { teamIds, userIds, role = 'member' } = req.body;
    
    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
      return res.status(400).json({ message: 'Team IDs array is required' });
    }
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    // Validate user has permission to add members to these teams
    const isAdmin = req.user.role === 'admin';
    let authorizedTeamIds = teamIds;
    
    if (!isAdmin) {
      // Get teams where user is lead
      const userTeams = await Team.find({ 
        _id: { $in: teamIds },
        members: { 
          $elemMatch: { 
            userId: req.user.id, 
            role: 'lead' 
          } 
        }
      }).select('_id');
      
      authorizedTeamIds = userTeams.map(team => team._id.toString());
      
      if (authorizedTeamIds.length === 0) {
        return res.status(403).json({ message: 'You do not have permission to add members to any of these teams' });
      }
    }

    // Validate all users exist
    const users = await User.find({ _id: { $in: userIds } }).select('_id');
    const validUserIds = users.map(user => user._id.toString());
    const invalidUserIds = userIds.filter(id => !validUserIds.includes(id));
    
    if (invalidUserIds.length > 0) {
      return res.status(400).json({ 
        message: 'Some user IDs are invalid', 
        invalidUserIds 
      });
    }

    // Track results for detailed response
    const results = {
      successful: [],
      failed: [],
      unauthorized: teamIds.filter(id => !authorizedTeamIds.includes(id))
    };

    // Add members to teams in parallel
    const addPromises = authorizedTeamIds.map(async (teamId) => {
      try {
        const team = await Team.findById(teamId);
        
        if (!team) {
          results.failed.push({ teamId, reason: 'Team not found' });
          return;
        }
        
        // Add each user to the team
        for (const userId of validUserIds) {
          // Check if user is already a member
          const existingMember = team.members.find(m => m.userId.toString() === userId);
          
          if (existingMember) {
            // Update role if different
            if (existingMember.role !== role) {
              existingMember.role = role;
            }
          } else {
            // Add new member
            team.members.push({ userId, role });
          }
        }
        
        await team.save();
        results.successful.push({ 
          teamId, 
          name: team.name,
          addedUsers: validUserIds.length 
        });
      } catch (error) {
        results.failed.push({ teamId, reason: error.message });
      }
    });

    await Promise.all(addPromises);

    return res.status(200).json({
      message: `Successfully added members to ${results.successful.length} teams`,
      results
    });
  } catch (error) {
    console.error('Bulk add members error:', error);
    return res.status(500).json({ message: 'Server error during bulk member assignment' });
  }
};

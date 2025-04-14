const User = require('../models/User');

/**
 * Get all users with filtering
 * @route GET /api/users
 * @access Private (Admin or Team Lead)
 */
exports.getUsers = async (req, res) => {
  try {
    // Check if user has permission to view all users
    const isAdmin = req.user.role === 'admin';
    const isTeamLead = req.user.role === 'team_lead';
    
    if (!isAdmin && !isTeamLead) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Extract filter parameters from query string
    const {
      search,
      roles,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 20
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Search filter (name or email)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Role filter
    if (roles) {
      const roleArray = roles.split(',');
      if (roleArray.length > 0) {
        filter.role = { $in: roleArray };
      }
    }
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query with pagination
    const users = await User.find(filter)
      .select('name email role createdAt')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .exec();
    
    // Get total count for pagination
    const totalCount = await User.countDocuments(filter);
    
    return res.status(200).json({
      users,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ message: 'Server error while fetching users' });
  }
};

/**
 * Get users by IDs
 * @route POST /api/users/by-ids
 * @access Private (Admin or Team Lead)
 */
exports.getUsersByIds = async (req, res) => {
  try {
    // Check if user has permission
    const isAdmin = req.user.role === 'admin';
    const isTeamLead = req.user.role === 'team_lead';
    
    if (!isAdmin && !isTeamLead) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }
    
    // Get users by IDs
    const users = await User.find({ _id: { $in: userIds } })
      .select('name email role')
      .exec();
    
    return res.status(200).json({ users });
  } catch (error) {
    console.error('Get users by IDs error:', error);
    return res.status(500).json({ message: 'Server error while fetching users' });
  }
};

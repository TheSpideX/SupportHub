const Team = require('../models/Team');
const Ticket = require('../models/Ticket'); // Assuming you have a Ticket model
const User = require('../models/User');

/**
 * Get team performance analytics
 * @route GET /api/teams/:id/analytics
 * @access Private (Admin or Team Lead/Member)
 */
exports.getTeamAnalytics = async (req, res) => {
  try {
    const teamId = req.params.id;
    
    // Verify team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Verify user has access to this team
    const isTeamMember = team.members.some(member => 
      member.userId.toString() === req.user.id
    );
    
    if (!isTeamMember && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get date range from query params or default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (req.query.days || 30));
    
    // Get all tickets for this team in the date range
    const tickets = await Ticket.find({
      teamId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('assignedTo', 'name');
    
    // Calculate overall metrics
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(ticket => ticket.status === 'resolved').length;
    const openTickets = tickets.filter(ticket => ticket.status === 'open').length;
    const inProgressTickets = tickets.filter(ticket => ticket.status === 'in-progress').length;
    
    // Calculate average resolution time
    let totalResolutionTime = 0;
    let resolvedCount = 0;
    
    tickets.forEach(ticket => {
      if (ticket.resolvedAt && ticket.createdAt) {
        const resolutionTime = ticket.resolvedAt - ticket.createdAt;
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }
    });
    
    const avgResolutionTime = resolvedCount > 0 
      ? totalResolutionTime / resolvedCount / (1000 * 60 * 60) // Convert to hours
      : 0;
    
    // Calculate member performance
    const memberPerformance = [];
    const memberMap = new Map();
    
    tickets.forEach(ticket => {
      if (ticket.assignedTo) {
        const userId = ticket.assignedTo._id.toString();
        const userName = ticket.assignedTo.name;
        
        if (!memberMap.has(userId)) {
          memberMap.set(userId, {
            userId,
            name: userName,
            ticketsAssigned: 0,
            ticketsResolved: 0,
            totalResolutionTime: 0,
            resolvedCount: 0
          });
        }
        
        const memberData = memberMap.get(userId);
        memberData.ticketsAssigned++;
        
        if (ticket.status === 'resolved') {
          memberData.ticketsResolved++;
          
          if (ticket.resolvedAt && ticket.createdAt) {
            const resolutionTime = ticket.resolvedAt - ticket.createdAt;
            memberData.totalResolutionTime += resolutionTime;
            memberData.resolvedCount++;
          }
        }
      }
    });
    
    // Calculate average resolution time for each member
    memberMap.forEach(member => {
      const avgTime = member.resolvedCount > 0 
        ? member.totalResolutionTime / member.resolvedCount / (1000 * 60 * 60) // Convert to hours
        : 0;
      
      memberPerformance.push({
        userId: member.userId,
        name: member.name,
        ticketsAssigned: member.ticketsAssigned,
        ticketsResolved: member.ticketsResolved,
        averageResolutionTime: avgTime
      });
    });
    
    // Calculate weekly activity
    const weeklyActivity = [];
    const weeks = Math.ceil(((endDate - startDate) / (1000 * 60 * 60 * 24)) / 7);
    
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekTickets = tickets.filter(ticket => 
        ticket.createdAt >= weekStart && ticket.createdAt <= weekEnd
      );
      
      const weekResolved = weekTickets.filter(ticket => 
        ticket.resolvedAt && ticket.resolvedAt >= weekStart && ticket.resolvedAt <= weekEnd
      );
      
      weeklyActivity.push({
        week: `Week ${i + 1}`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0],
        ticketsOpened: weekTickets.length,
        ticketsClosed: weekResolved.length
      });
    }
    
    // Calculate priority distribution
    const priorityDistribution = {
      low: tickets.filter(ticket => ticket.priority === 'low').length,
      medium: tickets.filter(ticket => ticket.priority === 'medium').length,
      high: tickets.filter(ticket => ticket.priority === 'high').length,
      critical: tickets.filter(ticket => ticket.priority === 'critical').length
    };
    
    // Return analytics data
    return res.status(200).json({
      teamId,
      teamName: team.name,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days: parseInt(req.query.days) || 30
      },
      overview: {
        totalTickets,
        resolvedTickets,
        openTickets,
        inProgressTickets,
        averageResolutionTime: avgResolutionTime
      },
      memberPerformance,
      weeklyActivity,
      priorityDistribution
    });
  } catch (error) {
    console.error('Team analytics error:', error);
    return res.status(500).json({ message: 'Server error while fetching team analytics' });
  }
};

/**
 * Get team member activity
 * @route GET /api/teams/:id/members/:memberId/activity
 * @access Private (Admin or Team Lead/Member)
 */
exports.getMemberActivity = async (req, res) => {
  try {
    const { id: teamId, memberId } = req.params;
    
    // Verify team exists and user is a member
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Verify user has access to this team
    const isTeamMember = team.members.some(member => 
      member.userId.toString() === req.user.id
    );
    
    if (!isTeamMember && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Verify member exists
    const member = team.members.find(m => m.userId.toString() === memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found in this team' });
    }
    
    // Get date range from query params or default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (req.query.days || 30));
    
    // Get all tickets for this member in the date range
    const tickets = await Ticket.find({
      teamId,
      assignedTo: memberId,
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Get user details
    const user = await User.findById(memberId).select('name email');
    
    // Calculate daily activity
    const dailyActivity = [];
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < days; i++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + i);
      
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const dayTickets = tickets.filter(ticket => 
        ticket.createdAt >= day && ticket.createdAt < nextDay
      );
      
      const dayResolved = tickets.filter(ticket => 
        ticket.resolvedAt && ticket.resolvedAt >= day && ticket.resolvedAt < nextDay
      );
      
      dailyActivity.push({
        date: day.toISOString().split('T')[0],
        ticketsAssigned: dayTickets.length,
        ticketsResolved: dayResolved.length
      });
    }
    
    // Return member activity data
    return res.status(200).json({
      teamId,
      teamName: team.name,
      member: {
        id: memberId,
        name: user?.name || 'Unknown',
        email: user?.email || 'Unknown',
        role: member.role
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days: parseInt(req.query.days) || 30
      },
      overview: {
        totalTickets: tickets.length,
        resolvedTickets: tickets.filter(ticket => ticket.status === 'resolved').length,
        openTickets: tickets.filter(ticket => ticket.status === 'open').length,
        inProgressTickets: tickets.filter(ticket => ticket.status === 'in-progress').length
      },
      dailyActivity
    });
  } catch (error) {
    console.error('Member activity error:', error);
    return res.status(500).json({ message: 'Server error while fetching member activity' });
  }
};

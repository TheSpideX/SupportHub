/**
 * Creates a standardized room identifier
 * @param {string} type - Room type (user, device, session, tab)
 * @param {string} id - Unique identifier
 * @returns {string} Formatted room identifier
 */
function createRoomId(type, id) {
  const validTypes = ['user', 'device', 'session', 'tab'];
  
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid room type: ${type}`);
  }
  
  if (!id) {
    throw new Error('Room ID is required');
  }
  
  return `${type}:${id}`;
}

/**
 * Parses a room identifier into its components
 * @param {string} roomId - Room identifier to parse
 * @returns {Object} Object with type and id properties
 */
function parseRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    throw new Error('Invalid room identifier');
  }
  
  const [type, ...idParts] = roomId.split(':');
  const id = idParts.join(':'); // Rejoin in case ID contains colons
  
  if (!type || !id) {
    throw new Error(`Malformed room identifier: ${roomId}`);
  }
  
  return { type, id };
}

module.exports = {
  createRoomId,
  parseRoomId
};
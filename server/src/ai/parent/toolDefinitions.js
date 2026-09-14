// server/src/ai/parent/toolDefinitions.js

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'find_babysitters',
      description: 'Find babysitters by filters. Use whenever the user wants to see, list, or find babysitters. Returns REAL babysitters from the database.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name fragment to search for' },
          city: { type: 'string', description: 'City to filter by' },
          min_rate: { type: 'number', description: 'Minimum hourly rate' },
          max_rate: { type: 'number', description: 'Maximum hourly rate' },
          min_rating: { type: 'number', description: 'Minimum average rating (0-5)' },
          limit: { type: 'integer', description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_babysitter_profile',
      description: 'Get the full profile of ONE babysitter: bio, rate, skills, availability, recent reviews. Only call this with a REAL user_id returned from find_babysitters.',
      parameters: {
        type: 'object',
        properties: {
          babysitter_id: { type: 'integer', description: 'User ID of the babysitter' },
        },
        required: ['babysitter_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_bookings',
      description: 'Get the current parent\'s own bookings. Use for "my bookings", "pending bookings", "upcoming".',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
          limit: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_children',
      description: 'Get the parent\'s own children.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_favorites',
      description: 'Get the parent\'s saved favorite babysitters.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_profile',
      description: 'Get the current user\'s basic profile (name, email, city, role).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_sitter_bookings',
      description: 'Babysitters only: get bookings where they are the sitter.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
          limit: { type: 'integer' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_earnings',
      description: 'Babysitters only: get earnings summary with monthly breakdown.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_profile_status',
      description: 'Babysitters only: get profile status (approved/pending/rejected), verification, document count, published slots.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

module.exports = TOOLS;
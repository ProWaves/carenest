// server/src/ai/admin/toolDefinitions.js
// The tool schemas the AI sees.
// Every tool here must have a matching handler in tools/index.js.

const TOOLS = [
  // ============================================
  // PLATFORM OVERVIEW
  // ============================================
  {
    type: 'function',
    function: {
      name: 'get_platform_snapshot',
      description: 'Get a full snapshot of the platform: user counts, booking counts, revenue, pending reports, pending approvals. Start here for any "how is the platform doing" question.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ============================================
  // USERS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'find_users',
      description: 'Search for users by name, email, or ID. Returns matching users with status.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name, email, or numeric ID' },
          limit: { type: 'integer', description: 'Max results (default 20)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_users_by_role',
      description: 'List users filtered by role and status.',
      parameters: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['parent', 'babysitter', 'admin'] },
          status: { type: 'string', enum: ['all', 'active', 'inactive', 'suspended'], description: 'Filter by status' },
          city: { type: 'string' },
          limit: { type: 'integer' },
        },
        required: ['role'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_full_profile',
      description: 'Get the complete profile of ONE user: account info, profile, wallet, earnings (if babysitter), bookings as parent, bookings as sitter, reviews received, reports against, reports filed. Use whenever the admin asks "tell me about user X" or "what is X doing".',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_warnings',
      description: 'Get a user\'s warning history from the last 90 days.',
      parameters: {
        type: 'object',
        properties: { user_id: { type: 'integer' } },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_flagged_users',
      description: 'Get users with 2+ reports in the last 90 days, ranked by report count and severity.',
      parameters: {
        type: 'object',
        properties: { limit: { type: 'integer' } },
      },
    },
  },

  // ============================================
  // EARNINGS & MONEY
  // ============================================
  {
    type: 'function',
    function: {
      name: 'get_babysitter_earnings',
      description: 'Get earnings breakdown for one babysitter: total, average per booking, monthly breakdown.',
      parameters: {
        type: 'object',
        properties: { babysitter_id: { type: 'integer' } },
        required: ['babysitter_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_platform_revenue',
      description: 'Get total revenue and daily breakdown for a period.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['day', 'week', 'month', 'year', 'all'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_earners',
      description: 'Get the top-earning babysitters for a period.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer' },
          period: { type: 'string', enum: ['month', 'year', 'all'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_wallet_summary',
      description: 'Get wallet balances across all babysitters.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_withdrawals',
      description: 'Get all pending withdrawal requests awaiting admin approval.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ============================================
  // BOOKINGS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'list_bookings',
      description: 'List recent bookings, optionally filtered by status.',
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
      name: 'get_booking_stats',
      description: 'Get booking statistics for a period: total, completed, cancelled, completion rate, average value.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['week', 'month', 'year', 'all'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cancellation_analysis',
      description: 'Analyze cancellations: total, top reasons, who cancels (parent vs babysitter), frequent cancellers.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ============================================
  // REVIEWS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'get_rating_distribution',
      description: 'Get the distribution of star ratings across all reviews.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_review_trends',
      description: 'Get monthly review trends and identify low-rated babysitters.',
      parameters: { type: 'object', properties: {} },
    },
  },

  // ============================================
  // REPORTS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'list_reports',
      description: 'List reports, optionally filtered by status and severity.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'reviewed', 'resolved', 'dismissed'] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          limit: { type: 'integer' },
        },
      },
    },
  },

  // ============================================
  // ACTIVITY & ANALYSIS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'get_activity_timeline',
      description: 'Get daily counts of bookings, signups, reports, cancellations for the last N days. Use for trend questions.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'integer', description: 'Number of days back (default 30, max 365)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_anomalies',
      description: 'Detect anomalies: frequent cancellers, babysitters with sudden activity drops, recently low-rated babysitters, heavily-reported users, revenue deviations. Use for "anything weird?" or proactive checks.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_comparison',
      description: 'Compare a metric between two time windows. Example: revenue this_week vs last_week.',
      parameters: {
        type: 'object',
        properties: {
          metric: { type: 'string', enum: ['revenue', 'bookings', 'signups'] },
          period_a: { type: 'string', enum: ['today', 'this_week', 'last_week', 'this_month', 'last_month'] },
          period_b: { type: 'string', enum: ['today', 'this_week', 'last_week', 'this_month', 'last_month'] },
        },
        required: ['metric', 'period_a', 'period_b'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_events',
      description: 'Get a chronological feed of everything that happened recently (signups, bookings, reports).',
      parameters: {
        type: 'object',
        properties: { hours: { type: 'integer', description: 'Hours back (default 24, max 168)' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_users_matching',
      description: 'Count users matching filters. Use this BEFORE any bulk destructive action to check row count against the safety cap.',
      parameters: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['parent', 'babysitter', 'admin'] },
          city: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'suspended'] },
        },
      },
    },
  },

  // ============================================
  // WRITE ACTIONS
  // ============================================
  {
    type: 'function',
    function: {
      name: 'warn_user',
      description: 'Issue a warning to a user. Reversible. 3 warnings in 90 days auto-suspends.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['user_id', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suspend_user',
      description: 'Suspend a user for N days. Sets is_active=false. Can be undone with activate_user.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
          reason: { type: 'string' },
          days: { type: 'integer', description: 'Default 7' },
        },
        required: ['user_id', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ban_user',
      description: 'Permanently ban a user. Cannot be undone easily. Ask "are you sure?" before calling.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['user_id', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'activate_user',
      description: 'Restore a suspended or banned user.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_babysitter',
      description: 'Approve a babysitter profile. Marks it verified.',
      parameters: {
        type: 'object',
        properties: { user_id: { type: 'integer' } },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reject_babysitter',
      description: 'Reject a babysitter profile.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'refund_booking',
      description: 'Issue a refund for a booking. Creates a refund record and notifies the parent.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: { type: 'integer' },
          amount: { type: 'number', description: 'Refund amount (default: full booking amount)' },
          reason: { type: 'string' },
        },
        required: ['booking_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_booking',
      description: 'Permanently delete a booking and free its slots. IRREVERSIBLE. Ask "are you sure?" before calling.',
      parameters: {
        type: 'object',
        properties: { booking_id: { type: 'integer' } },
        required: ['booking_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_user',
      description: 'Permanently delete a user and all related data. IRREVERSIBLE. Refuses to delete admins. Ask "are you sure?" before calling.',
      parameters: {
        type: 'object',
        properties: { user_id: { type: 'integer' } },
        required: ['user_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_notification',
      description: 'Send an in-app notification to one user.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'integer' },
          title: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['user_id', 'title', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_withdrawal',
      description: 'Approve a pending withdrawal request.',
      parameters: {
        type: 'object',
        properties: { withdrawal_id: { type: 'integer' } },
        required: ['withdrawal_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reject_withdrawal',
      description: 'Reject a pending withdrawal and refund the amount to the babysitter\'s wallet.',
      parameters: {
        type: 'object',
        properties: {
          withdrawal_id: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['withdrawal_id'],
      },
    },
  },
];

module.exports = TOOLS;
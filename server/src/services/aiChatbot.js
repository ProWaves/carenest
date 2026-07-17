// server/src/services/aiChatbot.js
const db = require('../config/database');

// Simple intent detection - can be replaced with OpenAI/LLM API
class AIChatbot {
  constructor() {
    this.intents = {
      booking: ['book', 'appointment', 'schedule', 'booking', 'reserve', 'hire', 'need a sitter', 'find sitter'],
      report: ['report', 'complaint', 'issue', 'problem', 'concern', 'bad experience', 'unhappy'],
      refund: ['refund', 'money back', 'reimburse', 'return payment', 'get my money back'],
      profile: ['profile', 'update', 'change', 'edit'],
      babysitter: ['babysitter', 'sitter', 'caregiver', 'nanny'],
      availability: ['available', 'free', 'schedule', 'when', 'working hours'],
      pricing: ['price', 'cost', 'rate', 'hourly', 'fee', 'how much'],
      cancel: ['cancel', 'reschedule', 'change date', 'postpone'],
      status: ['status', 'update', 'track', 'progress', 'where is'],
      help: ['help', 'support', 'assist', 'guide', 'how to']
    };
  }

  detectIntent(message) {
    const lower = message.toLowerCase();
    const detected = [];
    
    for (const [intent, keywords] of Object.entries(this.intents)) {
      if (keywords.some(kw => lower.includes(kw))) {
        detected.push(intent);
      }
    }
    
    return detected.length > 0 ? detected : ['general'];
  }

  async processMessage(userId, message, sessionData = {}) {
    const intents = this.detectIntent(message);
    console.log(`🎯 Detected intents: ${intents.join(', ')}`);
    
    // Get user context
    const user = await db.query(
      'SELECT id, role, first_name, last_name, email, city FROM users WHERE id = $1',
      [userId]
    );
    
    const userName = user.rows[0]?.first_name || 'User';
    const userRole = user.rows[0]?.role || 'user';
    const userCity = user.rows[0]?.city || 'your area';

    // Build response based on detected intents
    let responses = [];
    
    if (intents.includes('help')) {
      responses.push(this.getHelpResponse(userName));
    }
    
    if (intents.includes('booking') || intents.includes('babysitter')) {
      const bookingResponse = await this.handleBookingIntent(userId, message, sessionData, userRole, userCity);
      responses.push(bookingResponse);
    }
    
    if (intents.includes('report')) {
      const reportResponse = await this.handleReportIntent(userId, message, sessionData);
      responses.push(reportResponse);
    }
    
    if (intents.includes('refund')) {
      const refundResponse = await this.handleRefundIntent(userId, message, sessionData);
      responses.push(refundResponse);
    }
    
    if (intents.includes('cancel')) {
      const cancelResponse = await this.handleCancelIntent(userId, message, sessionData);
      responses.push(cancelResponse);
    }
    
    if (intents.includes('status')) {
      const statusResponse = await this.handleStatusIntent(userId);
      responses.push(statusResponse);
    }

    // Generic responses if no specific intent matched
    if (responses.length === 0 || responses.every(r => r === null)) {
      responses = [this.getGenericResponse(userName)];
    }

    // Filter out null responses and join
    const finalResponse = responses.filter(r => r !== null).join(' ');

    // Save conversation
    await this.saveConversation(userId, message, finalResponse, sessionData);
    
    // If action required, trigger notification
    if (sessionData.actionRequired) {
      const { createNotification } = require('../routes/notifications');
      await createNotification(
        userId,
        'ai_assistant_action',
        '🤖 AI Assistant Action Required',
        `Action needed: ${sessionData.actionRequired}`,
        '/dashboard'
      );
    }

    return {
      response: finalResponse,
      intents,
      actionRequired: sessionData.actionRequired || null,
      sessionData
    };
  }

  getHelpResponse(userName) {
    return `Hi ${userName}! I'm your AI assistant. I can help you with:
• 📅 Booking appointments with babysitters
• 📝 Reporting issues or concerns
• 💰 Refund requests
• 📊 Checking your booking status
• ❌ Cancelling bookings
• 🔍 Finding babysitters near you

Just tell me what you need help with!`;
  }

  async handleBookingIntent(userId, message, sessionData, userRole, userCity) {
    // Extract potential dates and times
    const dateMatch = message.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
    const timeMatch = message.match(/(\d{1,2}:\d{2})|(\d{1,2}\s?(am|pm))/i);
    const cityMatch = message.match(/in\s+([a-zA-Z\s]+)/i);
    
    if (userRole !== 'parent') {
      return "I see you're interested in bookings. As a babysitter, you'll receive booking requests from parents. Would you like to view your current bookings or update your availability?";
    }

    // Get user's pending bookings
    const bookings = await db.query(
      `SELECT b.*, u.first_name, u.last_name, u.city 
       FROM bookings b 
       JOIN users u ON u.id = b.babysitter_id 
       WHERE b.parent_id = $1 AND b.status = 'pending'
       ORDER BY b.start_date ASC`,
      [userId]
    );

    if (bookings.rows.length > 0) {
      const bookingList = bookings.rows.map(b => 
        `• ${b.first_name} ${b.last_name} on ${new Date(b.start_date).toLocaleDateString()} at ${b.start_time}`
      ).join('\n');
      
      return `You have ${bookings.rows.length} pending booking${bookings.rows.length > 1 ? 's' : ''}:
${bookingList}

Would you like to confirm, cancel, or discuss any of these?`;
    }

    if (dateMatch || timeMatch || cityMatch) {
      const dateStr = dateMatch ? dateMatch[0] : 'a specific date';
      const timeStr = timeMatch ? timeMatch[0] : 'time';
      const city = cityMatch ? cityMatch[1].trim() : userCity;
      
      return `Great! I can help you book a babysitter${city ? ` in ${city}` : ''} for ${dateStr} at ${timeStr}.

To find available babysitters in your area, I recommend:
1️⃣ Use our interactive map to see nearby babysitters
2️⃣ Browse the babysitter directory with filters
3️⃣ Tell me your preferences (experience, skills, budget)

Would you like me to search for available babysitters near you?`;
    }

    return "I can help you book a babysitter! Let me know when you need one (date and time), and I'll find available babysitters for you. You can also use our interactive map to see babysitters near you!";
  }

  async handleReportIntent(userId, message, sessionData) {
    const user = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
    const role = user.rows[0]?.role || 'user';

    // Check if user has any active bookings to report about
    const bookings = await db.query(
      `SELECT b.id, u.first_name, u.last_name, b.status 
       FROM bookings b 
       JOIN users u ON u.id = b.babysitter_id 
       WHERE b.parent_id = $1 AND b.status IN ('pending', 'confirmed', 'in_progress')
       UNION 
       SELECT b.id, u.first_name, u.last_name, b.status 
       FROM bookings b 
       JOIN users u ON u.id = b.parent_id 
       WHERE b.babysitter_id = $1 AND b.status IN ('pending', 'confirmed', 'in_progress')`,
      [userId]
    );

    if (bookings.rows.length === 0) {
      return "To report an issue, please go to the Report page from your dashboard, or let me know what specific problem you're experiencing.";
    }

    // If user mentions a specific issue
    const issueKeywords = ['late', 'rude', 'unprofessional', 'cancel', 'no show', 'damage', 'safety', 'harassment'];
    const hasIssue = issueKeywords.some(kw => message.toLowerCase().includes(kw));
    
    if (hasIssue) {
      const targetBooking = bookings.rows[0];
      sessionData.actionRequired = `Report issue with booking #${targetBooking.id}`;
      sessionData.bookingId = targetBooking.id;
      sessionData.reportedUserId = targetBooking.id; // This would need to be the babysitter ID
      
      return `I hear you're having an issue with ${targetBooking.first_name} ${targetBooking.last_name}. 
I'm sorry to hear that. I'll escalate this to our support team right away. 

Can you provide more details about what happened? (You'll receive a confirmation shortly)

📝 Your report will be reviewed by our admin team within 24 hours.`;
    }

    return `You have ${bookings.rows.length} active booking${bookings.rows.length > 1 ? 's' : ''}. 
If you need to report an issue with any of them, please let me know what the problem is, or go to the Report page in your dashboard.`;
  }

  async handleRefundIntent(userId, message, sessionData) {
    // Check if user has completed bookings eligible for refund
    const bookings = await db.query(
      `SELECT b.id, u.first_name, u.last_name, b.total_amount, b.start_date 
       FROM bookings b 
       JOIN users u ON u.id = b.babysitter_id 
       WHERE b.parent_id = $1 AND b.status = 'completed'
       ORDER BY b.start_date DESC
       LIMIT 5`,
      [userId]
    );

    if (bookings.rows.length === 0) {
      return "I don't see any completed bookings eligible for a refund. If you believe you're owed a refund, please contact our support team directly at support@carenest.com.";
    }

    const latestBooking = bookings.rows[0];
    return `💰 I can help with refund requests. I see your most recent booking was with ${latestBooking.first_name} ${latestBooking.last_name} on ${new Date(latestBooking.start_date).toLocaleDateString()} for $${latestBooking.total_amount}.

💡 Refund Policy:
• Refunds are processed within 5-7 business days
• Full refund for cancellations 24+ hours before start time
• Partial refund may apply for last-minute cancellations

To request a refund, please go to the Refund page in your dashboard or tell me the booking ID and reason.`;
  }

  async handleCancelIntent(userId, message, sessionData) {
    const bookings = await db.query(
      `SELECT b.id, u.first_name, u.last_name, b.start_date, b.status 
       FROM bookings b 
       JOIN users u ON u.id = b.babysitter_id 
       WHERE b.parent_id = $1 AND b.status IN ('pending', 'confirmed')
       ORDER BY b.start_date ASC`,
      [userId]
    );

    if (bookings.rows.length === 0) {
      return "You don't have any active bookings that can be cancelled. If you need to cancel a completed booking or have other questions, please contact support.";
    }

    const bookingList = bookings.rows.map((b, i) => 
      `${i + 1}. ${b.first_name} ${b.last_name} on ${new Date(b.start_date).toLocaleDateString()} (${b.status})`
    ).join('\n');

    return `You have ${bookings.rows.length} active booking${bookings.rows.length > 1 ? 's' : ''}:
${bookingList}

Please tell me which booking you want to cancel (number or name), and I'll help you with the cancellation process.

⚠️ Note: Cancellations within 24 hours of the booking may not be eligible for a full refund.`;
  }

  async handleStatusIntent(userId) {
    const [bookings, profile, userData] = await Promise.all([
      db.query(
        `SELECT COUNT(*) as total, 
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
         FROM bookings 
         WHERE parent_id = $1 OR babysitter_id = $1`,
        [userId]
      ),
      db.query(
        `SELECT bp.status, bp.is_verified, bp.hourly_rate 
         FROM babysitter_profiles bp 
         WHERE bp.user_id = $1`,
        [userId]
      ),
      db.query(
        `SELECT role, city FROM users WHERE id = $1`,
        [userId]
      )
    ]);

    let response = "📊 Here's your current status:\n\n";
    const stats = bookings.rows[0];
    response += `📅 Bookings: ${stats.total} total\n`;
    response += `  • ⏳ Pending: ${stats.pending}\n`;
    response += `  • ✅ Confirmed: ${stats.confirmed}\n`;
    response += `  • 🔄 In Progress: ${stats.in_progress}\n`;
    response += `  • 🎉 Completed: ${stats.completed}\n`;
    response += `  • ❌ Cancelled: ${stats.cancelled}\n\n`;

    if (profile.rows.length > 0) {
      response += `👶 Babysitter Profile:\n`;
      response += `  • Status: ${profile.rows[0].status}${profile.rows[0].is_verified ? ' ✅ Verified' : ''}\n`;
      response += `  • Rate: $${profile.rows[0].hourly_rate || 0}/hr\n`;
    }

    if (userData.rows.length > 0) {
      response += `📍 Location: ${userData.rows[0].city || 'Not set'}`;
    }

    return response;
  }

  getGenericResponse(userName) {
    const responses = [
      `Hi ${userName}! I'm your AI assistant. I can help you with:
• 📅 Booking appointments with babysitters
• 📝 Reporting issues or concerns
• 💰 Refund requests
• 📊 Checking your booking status
• ❌ Cancelling bookings

Just let me know what you need help with!`,
      `Hello ${userName}! How can I assist you today? I'm here to help with bookings, reports, refunds, or any other questions about CareNest.`,
      `👋 Hi ${userName}! Need help with something? I can assist with finding babysitters, managing bookings, or resolving issues.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async saveConversation(userId, userMessage, botResponse, sessionData) {
    try {
      await db.query(
        `INSERT INTO messages (sender_id, receiver_id, content, is_read) 
         VALUES ($1, $2, $3, true)`,
        [1, userId, `🤖 AI Assistant: ${botResponse}`]
      );
    } catch (error) {
      console.error('Save conversation error:', error);
    }
  }
}

module.exports = new AIChatbot();
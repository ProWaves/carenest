// server/src/routes/jobs.js
const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../routes/notifications');

const router = express.Router();

// ============================================
// HELPER FUNCTIONS
// ============================================

// Check if babysitter has conflicting jobs
const checkBabysitterAvailability = async (babysitterId, startDate, endDate, startTime, endTime, excludeJobId = null) => {
    try {
        // First check if the column exists
        const columnCheck = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'job_posts' 
            AND column_name = 'selected_babysitter_id'
        `);
        
        // If column doesn't exist, return no conflicts
        if (columnCheck.rows.length === 0) {
            console.log('⚠️ selected_babysitter_id column does not exist, skipping availability check');
            return [];
        }
        
        const query = `
            SELECT j.id, j.start_date, j.end_date, j.start_time, j.end_time, j.status
            FROM job_posts j
            WHERE j.selected_babysitter_id = $1
            AND j.status IN ('in_progress', 'active')
            AND j.id != COALESCE($2, 0)
            AND (
                (j.start_date <= $3 AND j.end_date >= $3)
                OR (j.start_date <= $4 AND j.end_date >= $4)
                OR (j.start_date >= $3 AND j.end_date <= $4)
            )
            AND (
                (j.start_time <= $5 AND j.end_time >= $5)
                OR (j.start_time <= $6 AND j.end_time >= $6)
                OR (j.start_time >= $5 AND j.end_time <= $6)
            )
        `;
        const result = await db.query(query, [babysitterId, excludeJobId, startDate, endDate, startTime, endTime]);
        return result.rows;
    } catch (error) {
        console.error('❌ Error checking babysitter availability:', error);
        // Return empty array on error to allow selection
        return [];
    }
};

// ============================================
// PARENT ROUTES
// ============================================

// POST /api/jobs - Create a job post
router.post('/', authenticate, authorize('parent'), async (req, res) => {
    try {
        const {
            title, description, child_age, child_count,
            start_date, end_date, start_time, end_time,
            hourly_rate, location
        } = req.body;

        if (!title || !start_date || !end_date || !start_time || !end_time || !hourly_rate) {
            return res.status(400).json({ error: 'Required fields missing.' });
        }

        const userCheck = await db.query(
            'SELECT suspended_at, is_active FROM users WHERE id = $1',
            [req.user.id]
        );
        if (userCheck.rows[0]?.suspended_at) {
            return res.status(403).json({ error: 'Your account is suspended.' });
        }

        const result = await db.query(
            `INSERT INTO job_posts (
                parent_id, title, description, child_age, child_count,
                start_date, end_date, start_time, end_time, hourly_rate, location
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [req.user.id, title, description || null, child_age || null, child_count || 1,
                start_date, end_date, start_time, end_time, hourly_rate, location || null]
        );

        // Notify available babysitters
        const babysitters = await db.query(
            `SELECT u.id FROM users u
             JOIN babysitter_profiles bp ON bp.user_id = u.id
             WHERE u.role = 'babysitter' AND u.is_active = true AND u.suspended_at IS NULL
             AND bp.status = 'approved'`
        );

        for (const bs of babysitters.rows) {
            await createNotification(
                bs.id,
                'new_job',
                '📢 New Job Available!',
                `${req.user.first_name} ${req.user.last_name} is looking for a babysitter. ${title}`,
                `/jobs/${result.rows[0].id}`
            );
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('❌ Create job post error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ⚠️ IMPORTANT: This route MUST come BEFORE /parent
// GET /api/jobs/parent/applicants/:jobId - Get applicants for a specific job
router.get('/parent/applicants/:jobId', authenticate, authorize('parent'), async (req, res) => {
    try {
        const { jobId } = req.params;
        
        console.log('📝 Fetching applicants for job:', jobId);
        console.log('👤 User ID:', req.user.id);

        // First, verify the job exists and belongs to the parent
        const jobCheck = await db.query(
            'SELECT id, parent_id, title, status FROM job_posts WHERE id = $1',
            [jobId]
        );

        console.log('📋 Job check result:', jobCheck.rows);

        if (jobCheck.rows.length === 0) {
            console.log('❌ Job not found:', jobId);
            return res.status(404).json({ 
                success: false,
                error: 'Job not found.',
                jobId: jobId 
            });
        }

        // Check if the job belongs to the current user
        if (jobCheck.rows[0].parent_id !== req.user.id) {
            console.log('❌ Permission denied. Job owner:', jobCheck.rows[0].parent_id, 'Current user:', req.user.id);
            return res.status(403).json({ 
                success: false,
                error: 'You do not have permission to view applicants for this job.'
            });
        }

        // Get applicants with full profile details - FIXED: removed LIMIT from subquery
        console.log('🔍 Fetching applicants for job:', jobId);
        const result = await db.query(
            `SELECT 
                a.id as application_id,
                a.job_post_id,
                a.babysitter_id,
                a.message,
                a.status as application_status,
                a.created_at as application_date,
                u.id as user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.avatar_url,
                u.city,
                u.phone,
                bp.hourly_rate,
                bp.experience_years,
                bp.is_verified,
                bp.bio,
                bp.status as profile_status,
                COALESCE((SELECT AVG(rating) FROM job_reviews WHERE reviewee_id = u.id), 0) as avg_rating,
                (SELECT COUNT(*) FROM job_reviews WHERE reviewee_id = u.id) as review_count,
                (SELECT json_agg(
                    json_build_object(
                        'rating', r.rating,
                        'comment', r.comment,
                        'created_at', r.created_at
                    )
                    ORDER BY r.created_at DESC
                ) FROM (
                    SELECT * FROM job_reviews WHERE reviewee_id = u.id ORDER BY created_at DESC LIMIT 3
                ) r) as recent_reviews
            FROM job_applications a
            JOIN users u ON u.id = a.babysitter_id
            LEFT JOIN babysitter_profiles bp ON bp.user_id = u.id
            WHERE a.job_post_id = $1
            ORDER BY 
                CASE 
                    WHEN a.status = 'pending' THEN 1
                    WHEN a.status = 'accepted' THEN 2
                    WHEN a.status = 'rejected' THEN 3
                    ELSE 4
                END,
                a.created_at DESC`,
            [jobId]
        );

        console.log(`✅ Found ${result.rows.length} applicants for job ${jobId}`);

        // Return success response with data
        res.json({
            success: true,
            job: {
                id: jobCheck.rows[0].id,
                title: jobCheck.rows[0].title,
                status: jobCheck.rows[0].status
            },
            applicants: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('❌ Get applicants error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch applicants',
            details: error.message,
            code: error.code
        });
    }
});

// GET /api/jobs/parent - Get parent's job posts with applicants
router.get('/parent', authenticate, authorize('parent'), async (req, res) => {
    try {
        console.log('📝 Fetching jobs for parent:', req.user.id);
        
        const result = await db.query(
            `SELECT j.*,
                (SELECT COUNT(*) FROM job_applications WHERE job_post_id = j.id) as application_count,
                (SELECT json_agg(
                    json_build_object(
                        'id', a.id,
                        'babysitter_id', a.babysitter_id,
                        'message', a.message,
                        'status', a.status,
                        'created_at', a.created_at,
                        'first_name', u.first_name,
                        'last_name', u.last_name,
                        'email', u.email,
                        'avatar_url', u.avatar_url,
                        'phone', u.phone,
                        'city', u.city,
                        'hourly_rate', bp.hourly_rate,
                        'experience_years', bp.experience_years,
                        'is_verified', bp.is_verified,
                        'bio', bp.bio,
                        'avg_rating', (SELECT COALESCE(AVG(rating), 0) FROM job_reviews WHERE reviewee_id = u.id)
                    )
                    ORDER BY a.created_at DESC
                ) FROM job_applications a
                JOIN users u ON u.id = a.babysitter_id
                LEFT JOIN babysitter_profiles bp ON bp.user_id = u.id
                WHERE a.job_post_id = j.id
               ) as applicants,
               (SELECT json_build_object(
                    'id', sb.id,
                    'first_name', sb.first_name,
                    'last_name', sb.last_name,
                    'email', sb.email,
                    'avatar_url', sb.avatar_url,
                    'phone', sb.phone,
                    'city', sb.city,
                    'hourly_rate', sbp.hourly_rate,
                    'experience_years', sbp.experience_years,
                    'is_verified', sbp.is_verified,
                    'bio', sbp.bio,
                    'avg_rating', (SELECT COALESCE(AVG(rating), 0) FROM job_reviews WHERE reviewee_id = sb.id)
               ) FROM users sb
               LEFT JOIN babysitter_profiles sbp ON sbp.user_id = sb.id
               WHERE sb.id = j.selected_babysitter_id
              ) as selected_babysitter_details
             FROM job_posts j
             WHERE j.parent_id = $1
             ORDER BY j.created_at DESC`,
            [req.user.id]
        );
        
        console.log(`✅ Found ${result.rows.length} jobs for parent`);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get parent jobs error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({ 
            error: 'Server error.',
            details: error.message 
        });
    }
});

// GET /api/jobs/parent/:id - Get single job with full details for parent
router.get('/parent/:id', authenticate, authorize('parent'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT j.*,
                (SELECT json_agg(
                    json_build_object(
                        'id', a.id,
                        'babysitter_id', a.babysitter_id,
                        'message', a.message,
                        'status', a.status,
                        'created_at', a.created_at,
                        'first_name', u.first_name,
                        'last_name', u.last_name,
                        'email', u.email,
                        'avatar_url', u.avatar_url,
                        'phone', u.phone,
                        'city', u.city,
                        'hourly_rate', bp.hourly_rate,
                        'experience_years', bp.experience_years,
                        'is_verified', bp.is_verified,
                        'bio', bp.bio,
                        'avg_rating', (SELECT COALESCE(AVG(rating), 0) FROM job_reviews WHERE reviewee_id = u.id),
                        'review_count', (SELECT COUNT(*) FROM job_reviews WHERE reviewee_id = u.id)
                    )
                    ORDER BY a.created_at DESC
                ) FROM job_applications a
                JOIN users u ON u.id = a.babysitter_id
                LEFT JOIN babysitter_profiles bp ON bp.user_id = u.id
                WHERE a.job_post_id = j.id
               ) as applicants,
               (SELECT json_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email,
                    'avatar_url', u.avatar_url,
                    'phone', u.phone,
                    'city', u.city,
                    'hourly_rate', bp.hourly_rate,
                    'experience_years', bp.experience_years,
                    'is_verified', bp.is_verified,
                    'bio', bp.bio,
                    'avg_rating', (SELECT COALESCE(AVG(rating), 0) FROM job_reviews WHERE reviewee_id = u.id)
               ) as selected_babysitter
               FROM users u
               LEFT JOIN babysitter_profiles bp ON bp.user_id = u.id
               WHERE u.id = j.selected_babysitter_id
              ) as selected_babysitter_details
             FROM job_posts j
             WHERE j.id = $1 AND j.parent_id = $2`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Get parent job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/:id - Edit job post (only if no babysitter selected yet)
router.put('/:id', authenticate, authorize('parent'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, child_age, child_count,
            start_date, end_date, start_time, end_time,
            hourly_rate, location
        } = req.body;

        // Check if job belongs to parent and is active
        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND parent_id = $2 AND status = $3',
            [id, req.user.id, 'active']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found, not yours, or not active.' });
        }

        // Check if already has a selected babysitter
        if (jobCheck.rows[0].selected_babysitter_id) {
            return res.status(400).json({ error: 'Cannot edit job after selecting a babysitter.' });
        }

        const result = await db.query(
            `UPDATE job_posts 
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 child_age = COALESCE($3, child_age),
                 child_count = COALESCE($4, child_count),
                 start_date = COALESCE($5, start_date),
                 end_date = COALESCE($6, end_date),
                 start_time = COALESCE($7, start_time),
                 end_time = COALESCE($8, end_time),
                 hourly_rate = COALESCE($9, hourly_rate),
                 location = COALESCE($10, location),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $11
             RETURNING *`,
            [title, description, child_age, child_count,
                start_date, end_date, start_time, end_time,
                hourly_rate, location, id]
        );

        res.json({
            message: 'Job updated successfully!',
            job: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Edit job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/jobs/:id - Delete job post (only if no babysitter selected yet)
router.delete('/:id', authenticate, authorize('parent'), async (req, res) => {
    try {
        const { id } = req.params;

        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND parent_id = $2 AND status = $3',
            [id, req.user.id, 'active']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found, not yours, or not active.' });
        }

        if (jobCheck.rows[0].selected_babysitter_id) {
            return res.status(400).json({ error: 'Cannot delete job after selecting a babysitter.' });
        }

        await db.query('DELETE FROM job_posts WHERE id = $1', [id]);

        res.json({ message: 'Job deleted successfully!' });
    } catch (error) {
        console.error('❌ Delete job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/:id/select - Parent selects a babysitter
router.put('/:id/select', authenticate, authorize('parent'), async (req, res) => {
    try {
        const { id } = req.params;
        const { babysitter_id } = req.body;

        if (!babysitter_id) {
            return res.status(400).json({ error: 'Babysitter ID required.' });
        }

        // Check if job belongs to parent and is active
        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND parent_id = $2 AND status = $3',
            [id, req.user.id, 'active']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found or not active.' });
        }

        // Check if babysitter applied
        const appCheck = await db.query(
            'SELECT * FROM job_applications WHERE job_post_id = $1 AND babysitter_id = $2',
            [id, babysitter_id]
        );
        if (appCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Babysitter has not applied for this job.' });
        }

        // Check babysitter availability
        const job = jobCheck.rows[0];
        const conflicts = await checkBabysitterAvailability(
            babysitter_id,
            job.start_date,
            job.end_date,
            job.start_time,
            job.end_time
        );

        if (conflicts.length > 0) {
            return res.status(409).json({
                error: 'Babysitter is not available during this time.',
                conflicts: conflicts
            });
        }

        // Begin transaction for atomic booking + selection
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Update job status and selected babysitter
            const result = await client.query(
                `UPDATE job_posts 
                 SET status = 'in_progress', 
                     selected_babysitter_id = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *`,
                [babysitter_id, id]
            );

            // Update application status for selected babysitter
            await client.query(
                `UPDATE job_applications 
                 SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
                 WHERE job_post_id = $1 AND babysitter_id = $2`,
                [id, babysitter_id]
            );

            // Reject all other applications
            await client.query(
                `UPDATE job_applications 
                 SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
                 WHERE job_post_id = $1 AND babysitter_id != $2 AND status = 'pending'`,
                [id, babysitter_id]
            );

            // Create a booking record from the job details
            const profile = await client.query(
                'SELECT hourly_rate FROM babysitter_profiles WHERE user_id = $1',
                [babysitter_id]
            );
            const hourlyRate = profile.rows[0]?.hourly_rate || job.hourly_rate;
            
            const startDateTime = new Date(`${job.start_date}T${job.start_time}`);
            const endDateTime = new Date(`${job.end_date}T${job.end_time}`);
            const totalHours = Math.max(1, (endDateTime - startDateTime) / (1000 * 60 * 60));
            const totalAmount = totalHours * parseFloat(hourlyRate);

            const bookingResult = await client.query(
                `INSERT INTO bookings (parent_id, babysitter_id, start_date, end_date, start_time, end_time, total_hours, total_amount, notes, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed')
                 RETURNING *`,
                [job.parent_id, babysitter_id, job.start_date, job.end_date, job.start_time, job.end_time, totalHours, totalAmount, job.description || null]
            );

            // Find and lock matching availability slots for this babysitter
            const matchingSlots = await client.query(
                `SELECT id FROM babysitter_availability 
                 WHERE babysitter_id = (SELECT id FROM babysitter_profiles WHERE user_id = $1)
                 AND is_booked = false
                 AND is_published = true
                 AND day_of_week = EXTRACT(DOW FROM $2::date)`,
                [babysitter_id, job.start_date]
            );

            for (const slot of matchingSlots.rows) {
                await client.query(
                    `UPDATE babysitter_availability 
                     SET is_booked = true, 
                         booked_booking_id = $1,
                         booked_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [bookingResult.rows[0].id, slot.id]
                );
            }

            await client.query('COMMIT');

            // Notify selected babysitter
            await createNotification(
                babysitter_id,
                'job_accepted',
                '🎉 You got the job!',
                `${req.user.first_name} ${req.user.last_name} has selected you for "${jobCheck.rows[0].title}"`,
                `/jobs/${id}`
            );

            // Notify other applicants
            const rejectedApps = await db.query(
                'SELECT babysitter_id FROM job_applications WHERE job_post_id = $1 AND babysitter_id != $2 AND status = $3',
                [id, babysitter_id, 'rejected']
            );
            for (const app of rejectedApps.rows) {
                await createNotification(
                    app.babysitter_id,
                    'job_rejected',
                    '❌ Job Filled',
                    `The job "${jobCheck.rows[0].title}" has been filled by another babysitter.`,
                    '/jobs'
                );
            }

            res.json({
                message: 'Babysitter selected and booking created successfully!',
                job: result.rows[0],
                booking: bookingResult.rows[0]
            });
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Select babysitter error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/:id/cancel-selection - Parent cancels selected babysitter
router.put('/:id/cancel-selection', authenticate, authorize('parent'), async (req, res) => {
    try {
        const { id } = req.params;

        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND parent_id = $2 AND status = $3',
            [id, req.user.id, 'in_progress']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found or not in progress.' });
        }

        const previousBabysitterId = jobCheck.rows[0].selected_babysitter_id;

        // Begin transaction
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Update job back to active
            const result = await client.query(
                `UPDATE job_posts 
                 SET status = 'active', 
                     selected_babysitter_id = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [id]
            );

            // Update applications - set previous babysitter back to pending, others back to pending
            await client.query(
                `UPDATE job_applications 
                 SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
                 WHERE job_post_id = $1 AND status IN ('accepted', 'rejected')`,
                [id]
            );

            // Cancel any associated booking and free its slots
            const relatedBooking = await client.query(
                `SELECT id FROM bookings 
                 WHERE parent_id = $1 AND babysitter_id = $2 
                 AND status NOT IN ('cancelled', 'completed')`,
                [req.user.id, previousBabysitterId]
            );

            if (relatedBooking.rows.length > 0) {
                for (const bk of relatedBooking.rows) {
                    await client.query(
                        `UPDATE bookings SET status = 'cancelled', 
                         cancellation_reason = 'Selection cancelled by parent',
                         cancelled_by = $1, updated_at = CURRENT_TIMESTAMP 
                         WHERE id = $2`,
                        [req.user.id, bk.id]
                    );
                    // Free all slots locked by this booking
                    await client.query(
                        `UPDATE babysitter_availability 
                         SET is_booked = false, booked_booking_id = NULL, booked_at = NULL
                         WHERE booked_booking_id = $1`,
                        [bk.id]
                    );
                }
            }

            await client.query('COMMIT');

            // Notify the previous babysitter
            await createNotification(
                previousBabysitterId,
                'job_cancelled',
                '❌ Selection Cancelled',
                `The parent has cancelled your selection for "${jobCheck.rows[0].title}". The job is available again.`,
                `/jobs/${id}`
            );

            // Notify all applicants that job is available again
            const applicants = await db.query(
                'SELECT DISTINCT babysitter_id FROM job_applications WHERE job_post_id = $1',
                [id]
            );
            for (const app of applicants.rows) {
                if (app.babysitter_id !== previousBabysitterId) {
                    await createNotification(
                        app.babysitter_id,
                        'job_available',
                        '🔄 Job Available Again',
                        `The job "${jobCheck.rows[0].title}" is available again!`,
                        `/jobs/${id}`
                    );
                }
            }

            res.json({
                message: 'Babysitter selection cancelled. Job is now available for all applicants.',
                job: result.rows[0]
            });
        } catch (txErr) {
            await client.query('ROLLBACK');
            throw txErr;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Cancel selection error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/jobs/:id/report - Report a user from a job
router.post('/:id/report', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { reported_user_id, reason, description } = req.body;

        if (!reported_user_id || !reason) {
            return res.status(400).json({ error: 'Reported user and reason required.' });
        }

        // Check if job exists and user is involved
        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1',
            [id]
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        const job = jobCheck.rows[0];
        if (req.user.id !== job.parent_id && req.user.id !== job.selected_babysitter_id) {
            return res.status(403).json({ error: 'You are not involved in this job.' });
        }

        // Check if report already exists
        const existing = await db.query(
            'SELECT id FROM reports WHERE job_post_id = $1 AND reporter_id = $2 AND reported_id = $3',
            [id, req.user.id, reported_user_id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You already reported this user for this job.' });
        }

        const result = await db.query(
            `INSERT INTO reports (reporter_id, reported_id, job_post_id, reason, description)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.user.id, reported_user_id, id, reason, description || null]
        );

        res.status(201).json({
            message: 'Report submitted successfully. Admin will review it.',
            report: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Create report error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============================================
// BABYSITTER ROUTES
// ============================================

// GET /api/jobs - Get all active jobs
router.get('/', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const { page = 1, limit = 20, sort = 'newest' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let orderClause = 'ORDER BY j.created_at DESC';
        if (sort === 'rate_high') orderClause = 'ORDER BY j.hourly_rate DESC';
        else if (sort === 'rate_low') orderClause = 'ORDER BY j.hourly_rate ASC';

        const result = await db.query(
            `SELECT j.*,
                u.first_name, u.last_name, u.city,
                (SELECT COUNT(*) FROM job_applications WHERE job_post_id = j.id) as application_count,
                (SELECT status FROM job_applications WHERE job_post_id = j.id AND babysitter_id = $1) as my_application_status
             FROM job_posts j
             JOIN users u ON u.id = j.parent_id
             WHERE j.status = 'active'
             AND j.start_date >= CURRENT_DATE
             ${orderClause}
             LIMIT $2 OFFSET $3`,
            [req.user.id, parseInt(limit), offset]
        );

        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM job_posts WHERE status = \'active\' AND start_date >= CURRENT_DATE'
        );

        res.json({
            jobs: result.rows,
            total: parseInt(countResult.rows[0].total),
            page: parseInt(page),
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
        });
    } catch (error) {
        console.error('❌ Get jobs error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/jobs/:id - Get single job
router.get('/:id', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT j.*,
                u.first_name, u.last_name, u.email, u.phone, u.city,
                (SELECT COUNT(*) FROM job_applications WHERE job_post_id = j.id) as application_count,
                (SELECT status FROM job_applications WHERE job_post_id = j.id AND babysitter_id = $1) as my_application_status
             FROM job_posts j
             JOIN users u ON u.id = j.parent_id
             WHERE j.id = $2`,
            [req.user.id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Get job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/jobs/applications/my - Get babysitter's applications with full details
router.get('/applications/my', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT a.*, 
                j.title, j.description, j.hourly_rate, j.start_date, j.end_date, j.start_time, j.end_time,
                j.status as job_status, j.selected_babysitter_id,
                u.first_name, u.last_name, u.city, u.phone, u.email,
                CASE 
                    WHEN j.selected_babysitter_id = $1 AND j.status = 'in_progress' THEN true 
                    ELSE false 
                END as is_selected
             FROM job_applications a
             JOIN job_posts j ON j.id = a.job_post_id
             JOIN users u ON u.id = j.parent_id
             WHERE a.babysitter_id = $1
             ORDER BY a.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get applications error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/jobs/my/assigned - Get babysitter's assigned jobs (in_progress)
router.get('/my/assigned', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT j.*,
                u.first_name, u.last_name, u.city, u.phone, u.email
             FROM job_posts j
             JOIN users u ON u.id = j.parent_id
             WHERE j.selected_babysitter_id = $1 AND j.status = 'in_progress'
             ORDER BY j.start_date ASC`,
            [req.user.id]
        );

        // Check for conflicts
        const jobsWithConflicts = [];
        for (const job of result.rows) {
            const conflicts = await checkBabysitterAvailability(
                req.user.id,
                job.start_date,
                job.end_date,
                job.start_time,
                job.end_time,
                job.id
            );
            jobsWithConflicts.push({
                ...job,
                has_conflicts: conflicts.length > 0,
                conflicts: conflicts
            });
        }

        res.json(jobsWithConflicts);
    } catch (error) {
        console.error('❌ Get assigned jobs error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/jobs/my/completed - Get babysitter's completed jobs
router.get('/my/completed', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT j.*,
                u.first_name, u.last_name, u.city,
                (SELECT json_build_object('rating', rating, 'comment', comment) 
                 FROM job_reviews 
                 WHERE job_post_id = j.id AND reviewee_id = $1) as review
             FROM job_posts j
             JOIN users u ON u.id = j.parent_id
             WHERE j.selected_babysitter_id = $1 AND j.status = 'completed'
             ORDER BY j.updated_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get completed jobs error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/jobs/:id/apply - Apply for a job
router.post('/:id/apply', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        const profileCheck = await db.query(
            `SELECT u.suspended_at, u.is_active, bp.status 
             FROM users u
             JOIN babysitter_profiles bp ON bp.user_id = u.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (profileCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Babysitter profile not found.' });
        }
        if (profileCheck.rows[0].suspended_at) {
            return res.status(403).json({ error: 'Your account is suspended.' });
        }
        if (profileCheck.rows[0].status !== 'approved') {
            return res.status(403).json({ error: 'Your profile must be approved to apply.' });
        }

        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND status = $2',
            [id, 'active']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found or no longer active.' });
        }

        const existing = await db.query(
            'SELECT id FROM job_applications WHERE job_post_id = $1 AND babysitter_id = $2',
            [id, req.user.id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You have already applied for this job.' });
        }

        const result = await db.query(
            `INSERT INTO job_applications (job_post_id, babysitter_id, message)
             VALUES ($1, $2, $3) RETURNING *`,
            [id, req.user.id, message || null]
        );

        await createNotification(
            jobCheck.rows[0].parent_id,
            'job_application',
            '📝 New Job Application',
            `${req.user.first_name} ${req.user.last_name} applied for your job: ${jobCheck.rows[0].title}`,
            `/jobs/${id}`
        );

        res.status(201).json({
            message: 'Application submitted successfully!',
            application: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Apply for job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/:id/withdraw-application - Withdraw application
router.put('/:id/withdraw-application', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const { id } = req.params;

        const appCheck = await db.query(
            'SELECT * FROM job_applications WHERE job_post_id = $1 AND babysitter_id = $2 AND status = $3',
            [id, req.user.id, 'pending']
        );
        if (appCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found or already processed.' });
        }

        await db.query(
            'UPDATE job_applications SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['cancelled', appCheck.rows[0].id]
        );

        res.json({ message: 'Application withdrawn successfully.' });
    } catch (error) {
        console.error('❌ Withdraw application error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/:id/start - Babysitter starts the job
router.put('/:id/start', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const { id } = req.params;

        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND selected_babysitter_id = $2 AND status = $3',
            [id, req.user.id, 'in_progress']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found or not assigned to you.' });
        }

        res.json({
            message: 'Job started successfully!',
            job: jobCheck.rows[0]
        });
    } catch (error) {
        console.error('❌ Start job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/:id/complete - Babysitter completes the job
router.put('/:id/complete', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const { id } = req.params;

        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND selected_babysitter_id = $2 AND status = $3',
            [id, req.user.id, 'in_progress']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found or not assigned to you.' });
        }

        const result = await db.query(
            `UPDATE job_posts 
             SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        // Notify parent
        await createNotification(
            jobCheck.rows[0].parent_id,
            'job_completed',
            '✅ Job Completed!',
            `${req.user.first_name} ${req.user.last_name} has completed the job. Please leave a review.`,
            `/jobs/${id}`
        );

        res.json({
            message: 'Job completed successfully!',
            job: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Complete job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/:id/cancel - Babysitter cancels the job
router.put('/:id/cancel', authenticate, authorize('babysitter'), async (req, res) => {
    try {
        const { id } = req.params;

        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND selected_babysitter_id = $2 AND status = $3',
            [id, req.user.id, 'in_progress']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found or not assigned to you.' });
        }

        // Update job back to active, remove selected babysitter
        const result = await db.query(
            `UPDATE job_posts 
             SET status = 'active', 
                 selected_babysitter_id = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        // Cancel associated bookings and free their slots
        const relatedBookings = await db.query(
            `SELECT id FROM bookings 
             WHERE parent_id = $1 AND babysitter_id = $2 
             AND status NOT IN ('cancelled', 'completed')`,
            [jobCheck.rows[0].parent_id, req.user.id]
        );

        for (const bk of relatedBookings.rows) {
            await db.query(
                `UPDATE bookings SET status = 'cancelled', 
                 cancellation_reason = 'Cancelled by babysitter',
                 cancelled_by = $1, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = $2`,
                [req.user.id, bk.id]
            );
            await db.query(
                `UPDATE babysitter_availability 
                 SET is_booked = false, booked_booking_id = NULL, booked_at = NULL
                 WHERE booked_booking_id = $1`,
                [bk.id]
            );
        }

        // Update applications - set this babysitter to cancelled
        await db.query(
            `UPDATE job_applications 
             SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
             WHERE job_post_id = $1 AND babysitter_id = $2`,
            [id, req.user.id]
        );

        // Update other applications back to pending
        await db.query(
            `UPDATE job_applications 
             SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
             WHERE job_post_id = $1 AND status IN ('accepted', 'rejected') AND babysitter_id != $2`,
            [id, req.user.id]
        );

        // Notify parent
        await createNotification(
            jobCheck.rows[0].parent_id,
            'job_cancelled',
            '❌ Job Cancelled by Babysitter',
            `${req.user.first_name} ${req.user.last_name} has cancelled the job. It is available again.`,
            `/jobs/${id}`
        );

        res.json({
            message: 'Job cancelled. It is now available for other babysitters.',
            job: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Cancel job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/:id/review - Leave a review
router.put('/:id/review', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment, reviewee_id } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
        }

        // Check if job is completed
        const jobCheck = await db.query(
            'SELECT * FROM job_posts WHERE id = $1 AND status = $2',
            [id, 'completed']
        );
        if (jobCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Job not found or not completed.' });
        }

        // Check if user is authorized to review
        if (req.user.id !== jobCheck.rows[0].parent_id && req.user.id !== jobCheck.rows[0].selected_babysitter_id) {
            return res.status(403).json({ error: 'Unauthorized.' });
        }

        // Check if review already exists
        const existing = await db.query(
            'SELECT id FROM job_reviews WHERE job_post_id = $1 AND reviewer_id = $2',
            [id, req.user.id]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'You already reviewed this job.' });
        }

        const result = await db.query(
            `INSERT INTO job_reviews (job_post_id, reviewer_id, reviewee_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [id, req.user.id, reviewee_id, rating, comment || null]
        );

        // Notify reviewee
        await createNotification(
            reviewee_id,
            'job_review',
            '⭐ New Review',
            `${req.user.first_name} ${req.user.last_name} left you a review for the job.`,
            `/jobs/${id}`
        );

        res.status(201).json({
            message: 'Review submitted successfully!',
            review: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Create job review error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/jobs/:id/reviews - Get reviews for a job
router.get('/:id/reviews', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT r.*, 
                u.first_name, u.last_name, u.avatar_url
             FROM job_reviews r
             JOIN users u ON u.id = r.reviewer_id
             WHERE r.job_post_id = $1
             ORDER BY r.created_at DESC`,
            [id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Get job reviews error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// ============================================
// ADMIN ROUTES
// ============================================

// GET /api/jobs/admin/stats - Get admin dashboard stats
router.get('/admin/stats', authenticate, authorize('admin'), async (req, res) => {
    try {
        // Total jobs stats
        const totalJobs = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
            FROM job_posts
        `);

        // Total users stats
        const userStats = await db.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN role = 'parent' THEN 1 END) as parents,
                COUNT(CASE WHEN role = 'babysitter' THEN 1 END) as babysitters,
                COUNT(CASE WHEN role = 'babysitter' AND suspended_at IS NOT NULL THEN 1 END) as suspended_babysitters,
                COUNT(CASE WHEN role = 'parent' AND suspended_at IS NOT NULL THEN 1 END) as suspended_parents
            FROM users
        `);

        // Total applications stats
        const applicationStats = await db.query(`
            SELECT 
                COUNT(*) as total_applications,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
            FROM job_applications
        `);

        // Recent jobs with parent and babysitter info
        const recentJobs = await db.query(`
            SELECT 
                j.id,
                j.title,
                j.status,
                j.created_at,
                j.start_date,
                j.end_date,
                p.first_name as parent_first_name,
                p.last_name as parent_last_name,
                p.email as parent_email,
                b.first_name as babysitter_first_name,
                b.last_name as babysitter_last_name,
                b.email as babysitter_email
            FROM job_posts j
            JOIN users p ON p.id = j.parent_id
            LEFT JOIN users b ON b.id = j.selected_babysitter_id
            ORDER BY j.created_at DESC
            LIMIT 20
        `);

        // Monthly job trends
        const monthlyTrends = await db.query(`
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                COUNT(*) as jobs_created,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as jobs_completed
            FROM job_posts
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month DESC
        `);

        // Top babysitters by jobs completed
        const topBabysitters = await db.query(`
            SELECT 
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                COUNT(j.id) as jobs_completed,
                COALESCE(AVG(r.rating), 0) as avg_rating
            FROM users u
            LEFT JOIN job_posts j ON j.selected_babysitter_id = u.id AND j.status = 'completed'
            LEFT JOIN job_reviews r ON r.reviewee_id = u.id
            WHERE u.role = 'babysitter'
            GROUP BY u.id
            ORDER BY jobs_completed DESC
            LIMIT 10
        `);

        // Reports stats
        const reportsStats = await db.query(`
            SELECT 
                COUNT(*) as total_reports,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
                COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_reports,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
                COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed_reports
            FROM reports
        `);

        res.json({
            totalJobs: totalJobs.rows[0],
            userStats: userStats.rows[0],
            applicationStats: applicationStats.rows[0],
            recentJobs: recentJobs.rows,
            monthlyTrends: monthlyTrends.rows,
            topBabysitters: topBabysitters.rows,
            reportsStats: reportsStats.rows[0]
        });
    } catch (error) {
        console.error('❌ Get admin stats error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/jobs/admin/jobs - Get all jobs for admin with filters
router.get('/admin/jobs', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { status, parent_id, babysitter_id, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = '1=1';
        const params = [];
        let paramCount = 1;

        if (status) {
            whereClause += ` AND j.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }
        if (parent_id) {
            whereClause += ` AND j.parent_id = $${paramCount}`;
            params.push(parent_id);
            paramCount++;
        }
        if (babysitter_id) {
            whereClause += ` AND j.selected_babysitter_id = $${paramCount}`;
            params.push(babysitter_id);
            paramCount++;
        }

        const query = `
            SELECT 
                j.*,
                p.first_name as parent_first_name,
                p.last_name as parent_last_name,
                p.email as parent_email,
                p.phone as parent_phone,
                b.first_name as babysitter_first_name,
                b.last_name as babysitter_last_name,
                b.email as babysitter_email,
                (SELECT COUNT(*) FROM job_applications WHERE job_post_id = j.id) as application_count
            FROM job_posts j
            JOIN users p ON p.id = j.parent_id
            LEFT JOIN users b ON b.id = j.selected_babysitter_id
            WHERE ${whereClause}
            ORDER BY j.created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM job_posts j
            WHERE ${whereClause}
        `;

        const result = await db.query(query, [...params, parseInt(limit), offset]);
        const countResult = await db.query(countQuery, params);

        res.json({
            jobs: result.rows,
            total: parseInt(countResult.rows[0].total),
            page: parseInt(page),
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
        });
    } catch (error) {
        console.error('❌ Get admin jobs error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/jobs/admin/reports - Get all reports
router.get('/admin/reports', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = '1=1';
        const params = [];
        let paramCount = 1;

        if (status) {
            whereClause += ` AND r.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        const query = `
            SELECT 
                r.*,
                rep.first_name as reporter_first_name,
                rep.last_name as reporter_last_name,
                rep.email as reporter_email,
                reported.first_name as reported_first_name,
                reported.last_name as reported_last_name,
                reported.email as reported_email,
                j.title as job_title,
                j.id as job_id
            FROM reports r
            JOIN users rep ON rep.id = r.reporter_id
            JOIN users reported ON reported.id = r.reported_id
            LEFT JOIN job_posts j ON j.id = r.job_post_id
            WHERE ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM reports r
            WHERE ${whereClause}
        `;

        const result = await db.query(query, [...params, parseInt(limit), offset]);
        const countResult = await db.query(countQuery, params);

        res.json({
            reports: result.rows,
            total: parseInt(countResult.rows[0].total),
            page: parseInt(page),
            totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
        });
    } catch (error) {
        console.error('❌ Get admin reports error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/admin/reports/:id - Update report status
router.put('/admin/reports/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;

        if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        const result = await db.query(
            `UPDATE reports 
             SET status = $1, 
                 admin_notes = COALESCE($2, admin_notes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [status, admin_notes || null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found.' });
        }

        // Log admin action
        await db.query(
            `INSERT INTO admin_logs (admin_id, action, details)
             VALUES ($1, $2, $3)`,
            [req.user.id, 'updated_report', { report_id: id, new_status: status }]
        );

        res.json({
            message: 'Report updated successfully!',
            report: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Update report error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/admin/users/:id/suspend - Suspend user
router.put('/admin/users/:id/suspend', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await db.query(
            `UPDATE users 
             SET suspended_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Log admin action
        await db.query(
            `INSERT INTO admin_logs (admin_id, action, details)
             VALUES ($1, $2, $3)`,
            [req.user.id, 'suspended_user', { user_id: id, reason: reason || 'No reason provided' }]
        );

        // Notify user
        await createNotification(
            id,
            'account_suspended',
            '🚫 Account Suspended',
            `Your account has been suspended. Reason: ${reason || 'Violation of terms of service.'}`,
            '/settings'
        );

        res.json({
            message: 'User suspended successfully!',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Suspend user error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/jobs/admin/users/:id/unsuspend - Unsuspend user
router.put('/admin/users/:id/unsuspend', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `UPDATE users 
             SET suspended_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Log admin action
        await db.query(
            `INSERT INTO admin_logs (admin_id, action, details)
             VALUES ($1, $2, $3)`,
            [req.user.id, 'unsuspended_user', { user_id: id }]
        );

        // Notify user
        await createNotification(
            id,
            'account_restored',
            '✅ Account Restored',
            'Your account has been reactivated. You can now use the platform again.',
            '/settings'
        );

        res.json({
            message: 'User unsuspended successfully!',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('❌ Unsuspend user error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/jobs/admin/jobs/:id - Admin deletes job
router.delete('/admin/jobs/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const jobCheck = await db.query('SELECT * FROM job_posts WHERE id = $1', [id]);
        if (jobCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        await db.query('DELETE FROM job_posts WHERE id = $1', [id]);

        // Log admin action
        await db.query(
            `INSERT INTO admin_logs (admin_id, action, details)
             VALUES ($1, $2, $3)`,
            [req.user.id, 'deleted_job', { job_id: id }]
        );

        res.json({ message: 'Job deleted successfully by admin.' });
    } catch (error) {
        console.error('❌ Admin delete job error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
});

module.exports = router;
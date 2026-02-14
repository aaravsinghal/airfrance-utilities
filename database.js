const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class PointsDatabase {
    constructor() {
        // Store database in the project directory
        const dbPath = path.join(__dirname, 'data', 'points.db');
        
        // Ensure data directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
        
        console.log(`📂 Database location: ${dbPath}`);
        
        try {
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.initialize();
            console.log('✅ Database connected successfully');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS flying_points (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                points INTEGER DEFAULT 0,
                last_updated INTEGER DEFAULT (strftime('%s', 'now'))
            );

            CREATE TABLE IF NOT EXISTS point_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                staff_id TEXT NOT NULL,
                staff_username TEXT NOT NULL,
                amount INTEGER NOT NULL,
                reason TEXT,
                timestamp INTEGER DEFAULT (strftime('%s', 'now'))
            );

            CREATE INDEX IF NOT EXISTS idx_user_points ON flying_points(points DESC);
            CREATE INDEX IF NOT EXISTS idx_history_user ON point_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_history_timestamp ON point_history(timestamp DESC);
        `);
        
        console.log('✅ Database tables initialized');
    }

    getPoints(userId) {
        const stmt = this.db.prepare('SELECT * FROM flying_points WHERE user_id = ?');
        return stmt.get(userId);
    }

    setPoints(userId, username, points) {
        const stmt = this.db.prepare(`
            INSERT INTO flying_points (user_id, username, points, last_updated)
            VALUES (?, ?, ?, strftime('%s', 'now'))
            ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                points = excluded.points,
                last_updated = excluded.last_updated
        `);
        return stmt.run(userId, username, points);
    }

    addPoints(userId, username, amount, staffId, staffUsername, reason = null) {
        const current = this.getPoints(userId);
        const newPoints = (current?.points || 0) + amount;
        
        this.db.transaction(() => {
            this.setPoints(userId, username, newPoints);
            this.addHistory(userId, staffId, staffUsername, amount, reason);
        })();

        return newPoints;
    }

    deductPoints(userId, username, amount, staffId, staffUsername, reason = null) {
        return this.addPoints(userId, username, -amount, staffId, staffUsername, reason);
    }

    addHistory(userId, staffId, staffUsername, amount, reason) {
        const stmt = this.db.prepare(`
            INSERT INTO point_history (user_id, staff_id, staff_username, amount, reason)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(userId, staffId, staffUsername, amount, reason);
    }

    getLeaderboard(limit = 10) {
        const stmt = this.db.prepare(`
            SELECT user_id, username, points, last_updated
            FROM flying_points
            WHERE points > 0
            ORDER BY points DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }

    getHistory(userId, limit = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM point_history
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `);
        return stmt.all(userId, limit);
    }

    getTotalUsers() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM flying_points WHERE points > 0');
        return stmt.get().count;
    }

    getTotalPoints() {
        const stmt = this.db.prepare('SELECT SUM(points) as total FROM flying_points');
        return stmt.get().total || 0;
    }

    getStats() {
        const totalUsers = this.getTotalUsers();
        const totalPoints = this.getTotalPoints();
        const totalTransactions = this.db.prepare('SELECT COUNT(*) as count FROM point_history').get().count;
        
        return { totalUsers, totalPoints, totalTransactions };
    }

    close() {
        this.db.close();
        console.log('📦 Database connection closed');
    }
}

module.exports = PointsDatabase;
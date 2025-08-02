const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path
const dbPath = path.join(__dirname, 'picvoice.db');

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Create users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create annotations table
        db.run(`CREATE TABLE IF NOT EXISTS annotations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          image_filename TEXT NOT NULL,
          mp3_filename TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          UNIQUE(user_id, image_filename)
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Insert default user if not exists
          db.run(`INSERT OR IGNORE INTO users (email) VALUES (?)`, ['testuser@gmail.com'], (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(db);
          });
        });
      });
    });
  });
}

// Get or create user
function getUser(email) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

// Save annotation
function saveAnnotation(userId, imageFilename, mp3Filename) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'INSERT OR REPLACE INTO annotations (user_id, image_filename, mp3_filename) VALUES (?, ?, ?)',
      [userId, imageFilename, mp3Filename],
      function(err) {
        db.close();
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      }
    );
  });
}

// Get annotations for a user
function getAnnotations(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all('SELECT * FROM annotations WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// Get annotation by user and image filename
function getAnnotation(userId, imageFilename) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get('SELECT * FROM annotations WHERE user_id = ? AND image_filename = ?', [userId, imageFilename], (err, row) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
      });
  });
}

module.exports = {
  initDatabase,
  getUser,
  saveAnnotation,
  getAnnotations,
  getAnnotation
}; 
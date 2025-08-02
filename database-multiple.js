const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database file path for multiple annotations version
const dbPath = path.join(__dirname, 'picvoice_multiple.db');

// Initialize database with multiple annotations support
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
        
        // Create annotations table with multiple annotations support
        db.run(`CREATE TABLE IF NOT EXISTS annotations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          image_filename TEXT NOT NULL,
          mp3_filename TEXT NOT NULL,
          annotation_name TEXT DEFAULT 'Annotation',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
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

// Save annotation (multiple allowed)
function saveAnnotation(userId, imageFilename, mp3Filename, annotationName = 'Annotation') {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'INSERT INTO annotations (user_id, image_filename, mp3_filename, annotation_name) VALUES (?, ?, ?, ?)',
      [userId, imageFilename, mp3Filename, annotationName],
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

// Get all annotations for a user
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

// Get all annotations for a specific image
function getImageAnnotations(userId, imageFilename) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all('SELECT * FROM annotations WHERE user_id = ? AND image_filename = ? ORDER BY created_at DESC', 
      [userId, imageFilename], (err, rows) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

// Get single annotation by ID
function getAnnotationById(annotationId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get('SELECT * FROM annotations WHERE id = ?', [annotationId], (err, row) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

// Delete specific annotation by ID
function deleteAnnotationById(annotationId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run('DELETE FROM annotations WHERE id = ?', [annotationId], function(err) {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes);
    });
  });
}

// Get annotation summary for images (for grid display)
function getAnnotationSummary(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(`
      SELECT 
        image_filename,
        COUNT(*) as annotation_count,
        MAX(created_at) as latest_annotation
      FROM annotations 
      WHERE user_id = ? 
      GROUP BY image_filename
      ORDER BY latest_annotation DESC
    `, [userId], (err, rows) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

module.exports = {
  initDatabase,
  getUser,
  saveAnnotation,
  getAnnotations,
  getImageAnnotations,
  getAnnotationById,
  deleteAnnotationById,
  getAnnotationSummary
}; 
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
        
        // Create images table
        db.run(`CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          filename TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          session_id INTEGER NOT NULL,
          is_favorite BOOLEAN DEFAULT 0,
          tags TEXT,
          is_deleted BOOLEAN DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Create annotations table with session_id
          db.run(`CREATE TABLE IF NOT EXISTS annotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            image_filename TEXT NOT NULL,
            mp3_filename TEXT NOT NULL,
            session_id INTEGER NOT NULL,
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
function saveAnnotation(userId, imageFilename, mp3Filename, sessionId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'INSERT INTO annotations (user_id, image_filename, mp3_filename, session_id) VALUES (?, ?, ?, ?)',
      [userId, imageFilename, mp3Filename, sessionId],
      function(err) {
        if (err) {
          console.error('Error saving annotation:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
        db.close();
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

// Legacy function removed - using getImageAnnotations instead

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

// Legacy function removed - using deleteAnnotationById instead

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

function saveImage(userId, filename, originalFilename, sessionId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'INSERT INTO images (user_id, filename, original_filename, session_id) VALUES (?, ?, ?, ?)',
      [userId, filename, originalFilename, sessionId],
      function(err) {
        if (err) {
          console.error('Error saving image:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
        db.close();
      }
    );
  });
}

function getCurrentSessionImages(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(
      `SELECT * FROM images 
       WHERE user_id = ? AND is_deleted = 0 
       AND session_id = (
         SELECT session_id FROM images 
         WHERE user_id = ? AND is_deleted = 0 
         ORDER BY upload_time DESC 
         LIMIT 1
       )
       ORDER BY upload_time DESC`,
      [userId, userId],
      (err, rows) => {
        if (err) {
          console.error('Error getting current session images:', err);
          reject(err);
        } else {
          resolve(rows);
        }
        db.close();
      }
    );
  });
}

function getAllImages(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(
      `SELECT * FROM images 
       WHERE user_id = ? AND is_deleted = 0 
       ORDER BY upload_time DESC`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Error getting all images:', err);
          reject(err);
        } else {
          resolve(rows);
        }
        db.close();
      }
    );
  });
}

function getImagesBySession(userId, sessionId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(
      `SELECT * FROM images 
       WHERE user_id = ? AND session_id = ? AND is_deleted = 0 
       ORDER BY upload_time DESC`,
      [userId, sessionId],
      (err, rows) => {
        if (err) {
          console.error('Error getting images by session:', err);
          reject(err);
        } else {
          resolve(rows);
        }
        db.close();
      }
    );
  });
}

function toggleFavorite(imageId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'UPDATE images SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?',
      [imageId],
      function(err) {
        if (err) {
          console.error('Error toggling favorite:', err);
          reject(err);
        } else {
          resolve(this.changes);
        }
        db.close();
      }
    );
  });
}

function updateImageTags(imageId, tags) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'UPDATE images SET tags = ? WHERE id = ?',
      [tags, imageId],
      function(err) {
        if (err) {
          console.error('Error updating tags:', err);
          reject(err);
        } else {
          resolve(this.changes);
        }
        db.close();
      }
    );
  });
}

function softDeleteImage(imageId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'UPDATE images SET is_deleted = 1 WHERE id = ?',
      [imageId],
      function(err) {
        if (err) {
          console.error('Error soft deleting image:', err);
          reject(err);
        } else {
          resolve(this.changes);
        }
        db.close();
      }
    );
  });
}

function getSessions(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(
      `SELECT DISTINCT session_id, 
              MIN(upload_time) as session_start,
              COUNT(*) as image_count
       FROM images 
       WHERE user_id = ? AND is_deleted = 0 
       GROUP BY session_id 
       ORDER BY session_start DESC`,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('Error getting sessions:', err);
          reject(err);
        } else {
          resolve(rows);
        }
        db.close();
      }
    );
  });
}

function getImageById(imageId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get(
      'SELECT * FROM images WHERE id = ? AND is_deleted = 0',
      [imageId],
      (err, row) => {
        if (err) {
          console.error('Error getting image by ID:', err);
          reject(err);
        } else {
          resolve(row);
        }
        db.close();
      }
    );
  });
}

function getImageByFilename(filename) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.get(
      'SELECT * FROM images WHERE filename = ? AND is_deleted = 0',
      [filename],
      (err, row) => {
        if (err) {
          console.error('Error getting image by filename:', err);
          reject(err);
        } else {
          resolve(row);
        }
        db.close();
      }
    );
  });
}

module.exports = {
  initDatabase,
  getUser,
  saveAnnotation,
  getAnnotations,
  getImageAnnotations,
  deleteAnnotationById,
  saveImage,
  getCurrentSessionImages,
  getAllImages,
  getImagesBySession,
  toggleFavorite,
  updateImageTags,
  softDeleteImage,
  getSessions,
  getImageById,
  getImageByFilename
}; 
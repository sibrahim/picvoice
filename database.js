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
      
      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create tables sequentially
        createTables(db)
          .then(() => {
            // Insert default user
            return insertDefaultUser(db);
          })
          .then(() => {
            resolve(db);
          })
          .catch(reject);
      });
    });
  });
}

// Create all database tables
function createTables(db) {
  return new Promise((resolve, reject) => {
    const tables = [
      {
        name: 'users',
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `
      },
      {
        name: 'images',
        sql: `
          CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            session_id INTEGER NOT NULL,
            is_favorite BOOLEAN DEFAULT 0,
            tags TEXT,
            is_deleted BOOLEAN DEFAULT 0,
            rotation_degrees INTEGER DEFAULT 0,
            ready INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `
      },
      {
        name: 'annotations',
        sql: `
          CREATE TABLE IF NOT EXISTS annotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            image_filename TEXT NOT NULL,
            mp3_filename TEXT NOT NULL,
            session_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `
      },
      {
        name: 'tags',
        sql: `
          CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, name),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `
      },
      {
        name: 'image_tags',
        sql: `
          CREATE TABLE IF NOT EXISTS image_tags (
            image_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (image_id, tag_id),
            FOREIGN KEY (image_id) REFERENCES images (id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
          )
        `
      }
    ];
    
    // Create tables one by one
    let currentIndex = 0;
    
    function createNextTable() {
      if (currentIndex >= tables.length) {
        // Create indexes after all tables are created
        createIndexes(db)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      const table = tables[currentIndex];
      db.run(table.sql, (err) => {
        if (err) {
          reject(new Error(`Failed to create ${table.name} table: ${err.message}`));
          return;
        }
        
        currentIndex++;
        createNextTable();
      });
    }
    
    createNextTable();
  });
}

// Insert default user
function insertDefaultUser(db) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO users (email) VALUES (?)',
      ['testuser@gmail.com'],
      (err) => {
        if (err) {
          reject(new Error(`Failed to insert default user: ${err.message}`));
          return;
        }
        resolve();
      }
    );
  });
}

// Create database indexes for better performance
function createIndexes(db) {
  return new Promise((resolve, reject) => {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_images_session_id ON images(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_images_ready ON images(ready)',
      'CREATE INDEX IF NOT EXISTS idx_images_is_favorite ON images(is_favorite)',
      'CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_annotations_image_filename ON annotations(image_filename)',
      'CREATE INDEX IF NOT EXISTS idx_annotations_session_id ON annotations(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_image_tags_image_id ON image_tags(image_id)',
      'CREATE INDEX IF NOT EXISTS idx_image_tags_tag_id ON image_tags(tag_id)'
    ];
    
    let currentIndex = 0;
    
    function createNextIndex() {
      if (currentIndex >= indexes.length) {
        resolve();
        return;
      }
      
      const indexSql = indexes[currentIndex];
      db.run(indexSql, (err) => {
        if (err) {
          console.warn(`Warning: Failed to create index: ${err.message}`);
          // Continue with other indexes even if one fails
        }
        
        currentIndex++;
        createNextIndex();
      });
    }
    
    createNextIndex();
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

// Save image metadata
function saveImage(userId, filename, originalFilename, sessionId, ready = 0) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'INSERT INTO images (user_id, filename, original_filename, session_id, ready) VALUES (?, ?, ?, ?, ?)',
      [userId, filename, originalFilename, sessionId, ready],
      function(err) {
        if (err) {
          console.error('Error saving image:', err);
          reject(err);
        } else {
          console.log('Image saved with ID:', this.lastID);
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

function updateImageRotation(imageId, rotationDegrees) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'UPDATE images SET rotation_degrees = ? WHERE id = ? AND is_deleted = 0',
      [rotationDegrees, imageId],
      function(err) {
        if (err) {
          console.error('Error updating image rotation:', err);
          reject(err);
        } else {
          resolve(this.changes);
        }
        db.close();
      }
    );
  });
}

// Get images ready for annotation (Ready=1 only)
function getReadyImages(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    // Get only Ready=1 images using the ready column
    db.all(
      `SELECT * FROM images 
       WHERE user_id = ? AND is_deleted = 0 
       AND ready = 1
       ORDER BY upload_time DESC`,
      [userId],
      (err, rows) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// Update ready flag for multiple images
function updateImagesReady(imageIds, ready) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    const placeholders = imageIds.map(() => '?').join(',');
    
    db.run(
      `UPDATE images SET ready = ? WHERE id IN (${placeholders}) AND is_deleted = 0`,
      [ready, ...imageIds],
      function(err) {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

// Tag management functions
function getAllTags(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(
      'SELECT * FROM tags WHERE user_id = ? ORDER BY name',
      [userId],
      (err, rows) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function createTag(userId, name, color = '#3b82f6', category = 'general') {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'INSERT INTO tags (user_id, name, color, category) VALUES (?, ?, ?, ?)',
      [userId, name, color, category],
      function(err) {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

function deleteTag(tagId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'DELETE FROM tags WHERE id = ?',
      [tagId],
      function(err) {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

function getImageTags(imageId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(
      `SELECT t.* FROM tags t 
       JOIN image_tags it ON t.id = it.tag_id 
       WHERE it.image_id = ?`,
      [imageId],
      (err, rows) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

function addTagToImage(imageId, tagId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)',
      [imageId, tagId],
      function(err) {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

function removeTagFromImage(imageId, tagId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.run(
      'DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?',
      [imageId, tagId],
      function(err) {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
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
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      }
    );
  });
}

// Get images by favorite status
function getImagesByFavoriteStatus(userId, isFavorite) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(
      `SELECT * FROM images 
       WHERE user_id = ? AND is_deleted = 0 
       AND is_favorite = ?
       ORDER BY upload_time DESC`,
      [userId, isFavorite ? 1 : 0],
      (err, rows) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// Get sessions with ready count
function getSessionsWithReadyCount(userId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    db.all(
      `SELECT 
        session_id,
        COUNT(*) as total_images,
        SUM(CASE WHEN ready = 1 THEN 1 ELSE 0 END) as ready_images,
        MAX(upload_time) as last_upload
       FROM images 
       WHERE user_id = ? AND is_deleted = 0 
       GROUP BY session_id 
       ORDER BY session_id DESC`,
      [userId],
      (err, rows) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
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
  getImageByFilename,
  updateImageRotation,
  getReadyImages,
  updateImagesReady,
  getSessionsWithReadyCount,
  getAllTags,
  createTag,
  deleteTag,
  getImageTags,
  addTagToImage,
  removeTagFromImage,
  getImagesByFavoriteStatus
}; 
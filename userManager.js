const fs = require('fs');
const path = require('path');

// Base directories
const USERS_DIR = 'users';
const UPLOADS_DIR = 'uploads';
const OUTPUTS_DIR = 'outputs';
const TEMP_DIR = 'temp';

// Ensure user directories exist
function ensureUserDirectories(userEmail) {
  const userDir = path.join(USERS_DIR, userEmail);
  const uploadsDir = path.join(userDir, UPLOADS_DIR);
  const outputsDir = path.join(userDir, OUTPUTS_DIR);
  const tempDir = path.join(userDir, TEMP_DIR);
  
  // Create directories if they don't exist
  [userDir, uploadsDir, outputsDir, tempDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  return {
    userDir,
    uploadsDir,
    outputsDir,
    tempDir
  };
}

// Get user uploads directory
function getUserUploadsDir(userEmail) {
  const dirs = ensureUserDirectories(userEmail);
  return dirs.uploadsDir;
}

// Get user outputs directory
function getUserOutputsDir(userEmail) {
  const dirs = ensureUserDirectories(userEmail);
  return dirs.outputsDir;
}

// Get user temp directory
function getUserTempDir(userEmail) {
  const dirs = ensureUserDirectories(userEmail);
  return dirs.tempDir;
}

// Get user's uploaded images
function getUserImages(userEmail) {
  const uploadsDir = getUserUploadsDir(userEmail);
  
  if (!fs.existsSync(uploadsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(uploadsDir);
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
  });
}

// Save uploaded file to user directory
function saveUserFile(userEmail, file, originalName) {
  const uploadsDir = getUserUploadsDir(userEmail);
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const timestamp = Date.now();
  const filename = `${baseName}_${timestamp}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  
  // Copy file to user directory
  fs.copyFileSync(file.path, filePath);
  
  return {
    filename,
    path: filePath,
    originalName
  };
}

// Clean up user's temp directory
function cleanupUserTemp(userEmail) {
  const tempDir = getUserTempDir(userEmail);
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      fs.unlinkSync(filePath);
    });
  }
}

// Get user's annotation files
function getUserAnnotationFiles(userEmail) {
  const outputsDir = getUserOutputsDir(userEmail);
  
  if (!fs.existsSync(outputsDir)) {
    return [];
  }
  
  const files = fs.readdirSync(outputsDir);
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.mp3';
  });
}

module.exports = {
  ensureUserDirectories,
  getUserUploadsDir,
  getUserOutputsDir,
  getUserTempDir,
  getUserImages,
  saveUserFile,
  cleanupUserTemp,
  getUserAnnotationFiles
}; 
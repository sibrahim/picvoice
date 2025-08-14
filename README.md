# PicVoice Multi-User Prototype

A voice annotation system for photographs with multi-user support and database-based storage.

## Architecture Overview

### Multi-User Support
- Each user has their own directory structure: `users/{email}/uploads/` and `users/{email}/outputs/`
- User authentication is currently hardcoded to `testuser@gmail.com`
- All user data is isolated in separate directories

### Database-Based Annotations
- SQLite database stores user annotations instead of JSON files
- Database schema:
  - `users` table: user information
  - `annotations` table: links images to MP3 files
- No duplicate image files are created - only the original image and MP3 are stored

### File Structure
```
users/
├── testuser@gmail.com/
│   ├── uploads/          # User's uploaded images
│   └── outputs/          # User's generated MP3 files
temp_uploads/             # Temporary upload directory
picvoice.db              # SQLite database
```

## Features

### 1. Bulk Image Upload
- Select entire folders of images from your local machine
- All images are uploaded to your personal user directory
- Supported formats: JPG, JPEG, PNG, GIF, BMP, WebP

### 2. Voice Annotations
- Record voice annotations for each image
- Annotations are saved to the database linking image to MP3
- Download both the original image and MP3 file

### 3. User Isolation
- Each user's images and annotations are completely separate
- No cross-user data access
- Scalable architecture for future multi-user deployment

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Access the application:
   - Local: http://localhost:3000
- iPad/Remote: http://[YOUR_COMPUTER_IP]:3000

## API Endpoints

### Upload Images
- `POST /upload-images` - Upload multiple images to user directory

### Get User Data
- `GET /api/images` - Get user's uploaded images
- `GET /api/annotations` - Get user's annotations
- `GET /api/annotation/:imageFilename` - Get specific annotation

### Create Annotations
- `POST /create-video` - Create MP3 annotation from image and audio

### Static File Serving
- `/users/:user/uploads/*` - Serve user's uploaded images
- `/users/:user/outputs/*` - Serve user's MP3 files

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Annotations Table
```sql
CREATE TABLE annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  image_filename TEXT NOT NULL,
  mp3_filename TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE(user_id, image_filename)
);
```

## Usage

1. **Upload Images**: Click "Upload folder of images" and select a folder containing images
2. **Navigate**: Use Previous/Next buttons or arrow keys to browse images
3. **Record**: Press "Press to Record" (or Spacebar) to start recording
4. **Stop**: Press "Stop Recording" (or Q) to finish recording
5. **Download**: Use the download links in the Output Preview section

## Technical Details

- **Backend**: Node.js with Express
- **Database**: SQLite3
- **File Processing**: FFmpeg for audio conversion
- **Frontend**: Vanilla JavaScript with responsive design
- **File Storage**: User-specific directories with automatic creation

## Future Enhancements

- User authentication and login system
- User registration and management
- Shared annotations between users
- Advanced audio processing options
- Cloud storage integration
- Mobile app development

## Requirements

- Node.js 14+
- FFmpeg installed and available in PATH
- Modern web browser with microphone access 
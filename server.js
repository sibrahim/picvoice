
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const db = require('./database');
const userManager = require('./userManager');

const app = express();
const port = 3000;

// Hardcoded user for now
const DEFAULT_USER = 'testuser@gmail.com';

// Enable CORS for iPad access
app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Serve user-specific static files
app.use('/users/:user/uploads', (req, res, next) => {
  const userEmail = req.params.user;
  const uploadsDir = userManager.getUserUploadsDir(userEmail);
  express.static(uploadsDir)(req, res, next);
});

app.use('/users/:user/outputs', (req, res, next) => {
  const userEmail = req.params.user;
  const outputsDir = userManager.getUserOutputsDir(userEmail);
  express.static(outputsDir)(req, res, next);
});

// Initialize database on startup
db.initDatabase().then(() => {
  console.log('Database initialized successfully');
}).catch(err => {
  console.error('Database initialization failed:', err);
});

// Get current user (hardcoded for now)
async function getCurrentUser() {
  return await db.getUser(DEFAULT_USER);
}

// Create user-specific multer storage
function createUserStorage(userEmail) {
  return multer.diskStorage({
    destination: userManager.getUserTempDir(userEmail),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext);
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      cb(null, `${base}_${timestamp}_${randomId}${ext}`);
    }
  });
}

// Upload multiple images endpoint
app.post('/upload-images', async (req, res) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Create user-specific upload middleware
    const userUpload = multer({ storage: createUserStorage(user.email) });
    
    // Use the user-specific upload middleware
    userUpload.array('images')(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      try {
        const uploadedFiles = [];
        
        for (const file of req.files) {
          if (!file.mimetype.startsWith('image/')) {
            continue; // Skip non-image files
          }
          
          const savedFile = userManager.saveUserFile(user.email, file, file.originalname);
          uploadedFiles.push(savedFile);
        }

        // Clean up temp files
        userManager.cleanupUserTemp(user.email);

        res.json({ 
          success: true, 
          uploaded: uploadedFiles.length,
          files: uploadedFiles.map(f => f.filename)
        });
      } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Processing failed' });
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get user's images
app.get('/api/images', async (req, res) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const images = userManager.getUserImages(user.email);
    res.json({ images });
  } catch (error) {
    console.error('Error getting images:', error);
    res.status(500).json({ error: 'Failed to get images' });
  }
});

// Get user's annotations
app.get('/api/annotations', async (req, res) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const annotations = await db.getAnnotations(user.id);
    res.json({ annotations });
  } catch (error) {
    console.error('Error getting annotations:', error);
    res.status(500).json({ error: 'Failed to get annotations' });
  }
});

// Create video/audio annotation
app.post('/create-video', async (req, res) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Create user-specific upload middleware for this request
    const userUpload = multer({ storage: createUserStorage(user.email) });
    
    userUpload.fields([{ name: 'image' }, { name: 'audio' }])(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: 'Upload failed' });
      }

      try {
        const image = req.files['image'][0];
        const audio = req.files['audio'][0];
        const outputType = req.body.output || 'mp3';

        // Validate
        if (!image || !audio) {
          return res.status(400).send('Image and audio are required.');
        }
        if (!image.mimetype.startsWith('image/') || !audio.mimetype.startsWith('audio/')) {
          return res.status(400).send('Invalid file types.');
        }

        // Save image to user directory
        const savedImage = userManager.saveUserFile(user.email, image, image.originalname);
        const outputsDir = userManager.getUserOutputsDir(user.email);
        
        const baseName = path.basename(savedImage.filename, path.extname(savedImage.filename));
        const timestamp = Date.now();
        const outputFileName = `${baseName}_${timestamp}`;

        if (outputType === 'mp3') {
          const mp3Path = path.join(outputsDir, `${outputFileName}.mp3`);

          const cmd = spawn('ffmpeg', [
            '-i', audio.path,
            '-vn',
            '-ar', '44100',
            '-ac', '2',
            '-b:a', '192k',
            '-y', mp3Path
          ]);

          cmd.stderr.on('data', data => console.error(`stderr: ${data}`));

          cmd.on('close', async (code) => {
            if (code !== 0) {
              return res.status(500).send('ffmpeg mp3 conversion failed');
            }

            try {
              // Save annotation to database
              const mp3Filename = `${outputFileName}.mp3`;
              await db.saveAnnotation(user.id, savedImage.filename, mp3Filename);

              // Clean up temp files
              userManager.cleanupUserTemp(user.email);

              res.json({ 
                output_audio: `/users/${user.email}/outputs/${mp3Filename}`,
                output_image: `/users/${user.email}/uploads/${savedImage.filename}`,
                image_filename: savedImage.filename,
                mp3_filename: mp3Filename
              });
            } catch (dbError) {
              console.error('Database error:', dbError);
              res.status(500).send('Database save failed');
            }
          });

        } else {
          // default to mp4 video
          const outputVideo = path.join(outputsDir, `${outputFileName}.mp4`);

          const cmd = spawn('ffmpeg', [
            '-loop', '1',
            '-i', savedImage.path,
            '-i', audio.path,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-shortest',
            '-pix_fmt', 'yuv420p',
            '-y', outputVideo
          ]);

          cmd.stderr.on('data', data => console.error(`stderr: ${data}`));

          cmd.on('close', async (code) => {
            if (code !== 0) {
              return res.status(500).send('ffmpeg mp4 conversion failed');
            }

            try {
              // Save annotation to database
              const videoFilename = `${outputFileName}.mp4`;
              await db.saveAnnotation(user.id, savedImage.filename, videoFilename);

              // Clean up temp files
              userManager.cleanupUserTemp(user.email);

              res.json({ 
                output: `/users/${user.email}/outputs/${videoFilename}`,
                image_filename: savedImage.filename,
                video_filename: videoFilename
              });
            } catch (dbError) {
              console.error('Database error:', dbError);
              res.status(500).send('Database save failed');
            }
          });

          setTimeout(() => {
            cmd.kill('SIGKILL');
          }, 30000);
        }
      } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'Processing failed' });
      }
    });
  } catch (error) {
    console.error('Create video error:', error);
    res.status(500).json({ error: 'Create video failed' });
  }
});

// Get annotation for specific image
app.get('/api/annotation/:imageFilename', async (req, res) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const annotation = await db.getAnnotation(user.id, req.params.imageFilename);
    if (annotation) {
      res.json({
        image_filename: annotation.image_filename,
        mp3_filename: annotation.mp3_filename,
        output_audio: `/users/${user.email}/outputs/${annotation.mp3_filename}`,
        output_image: `/users/${user.email}/uploads/${annotation.image_filename}`,
        created_at: annotation.created_at
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error getting annotation:', error);
    res.status(500).json({ error: 'Failed to get annotation' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`PicVoice multi-user prototype running at http://0.0.0.0:${port}`);
  console.log(`Access from iPad: http://[YOUR_COMPUTER_IP]:${port}`);
  console.log(`Current user: ${DEFAULT_USER}`);
});

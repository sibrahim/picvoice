
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

// Upload images endpoint
app.post('/upload-images', async (req, res) => {
  try {
    const user = await db.getUser(DEFAULT_USER);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Create user-specific multer storage
    const userUpload = multer({
      storage: createUserStorage(user.email),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    });

    userUpload.array('images')(req, res, async (err) => {
      if (err) {
        return res.status(400).send(err.message);
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).send('No images uploaded');
      }

      try {
        // Generate new session ID for this upload
        const sessionId = Date.now();
        const savedImages = [];

        // Process each uploaded file
        for (const file of req.files) {
          const savedImage = userManager.saveUserFile(user.email, file, file.originalname);
          savedImages.push(savedImage);
          
          // Save image info to database
          await db.saveImage(user.id, savedImage.filename, file.originalname, sessionId);
        }

        // Clean up temp files
        userManager.cleanupUserTemp(user.email);

        res.json({ 
          message: `${savedImages.length} images uploaded successfully`,
          sessionId: sessionId,
          images: savedImages.map(img => ({
            filename: img.filename,
            originalName: img.originalName,
            url: `/users/${user.email}/uploads/${img.filename}`
          }))
        });
      } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).send('Upload processing failed');
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).send('Upload failed');
  }
});

// Get images endpoint - returns only current session images
app.get('/api/images', async (req, res) => {
  try {
    const user = await db.getUser(DEFAULT_USER);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const images = await db.getCurrentSessionImages(user.id);
    res.json({ images: images.map(img => ({
      id: img.id,
      filename: img.filename,
      original_filename: img.original_filename,
      upload_time: img.upload_time,
      session_id: img.session_id,
      is_favorite: img.is_favorite,
      tags: img.tags,
      url: `/users/${user.email}/uploads/${img.filename}`
    })) });
  } catch (error) {
    console.error('Error getting images:', error);
    res.status(500).send('Failed to get images');
  }
});

// Get all images for management interface
app.get('/api/all-images', async (req, res) => {
  try {
    const user = await db.getUser(DEFAULT_USER);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const images = await db.getAllImages(user.id);
    res.json({ images: images.map(img => ({
      id: img.id,
      filename: img.filename,
      original_filename: img.original_filename,
      upload_time: img.upload_time,
      session_id: img.session_id,
      is_favorite: img.is_favorite,
      tags: img.tags,
      url: `/users/${user.email}/uploads/${img.filename}`
    })) });
  } catch (error) {
    console.error('Error getting all images:', error);
    res.status(500).send('Failed to get all images');
  }
});

// Get sessions for management interface
app.get('/api/sessions', async (req, res) => {
  try {
    const user = await db.getUser(DEFAULT_USER);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const sessions = await db.getSessions(user.id);
    res.json({ sessions });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).send('Failed to get sessions');
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

        // Use existing image file (don't create duplicate)
        const imageFilename = image.originalname;
        const outputsDir = userManager.getUserOutputsDir(user.email);
        
        // Create unique MP3 filename
        const timestamp = Date.now();
        const outputFileName = `${path.basename(imageFilename, path.extname(imageFilename))}_${timestamp}`;

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
              // Get the session_id for this image
              const imageInfo = await db.getImageByFilename(imageFilename);
              const sessionId = imageInfo ? imageInfo.session_id : Date.now();
              
              // Save annotation to database using the existing image filename
              const mp3Filename = `${outputFileName}.mp3`;
              await db.saveAnnotation(user.id, imageFilename, mp3Filename, sessionId);

              // Clean up temp files
              userManager.cleanupUserTemp(user.email);

              res.json({ 
                output_audio: `/users/${user.email}/outputs/${mp3Filename}`,
                output_image: `/users/${user.email}/uploads/${imageFilename}`,
                image_filename: imageFilename,
                mp3_filename: mp3Filename,
                session_id: sessionId
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
// Legacy endpoint removed - using /api/image/:imageFilename/annotations instead

// Get all annotations for a specific image
app.get('/api/image/:imageFilename/annotations', async (req, res) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const annotations = await db.getImageAnnotations(user.id, req.params.imageFilename);
    const formattedAnnotations = annotations.map(annotation => ({
      id: annotation.id,
      image_filename: annotation.image_filename,
      mp3_filename: annotation.mp3_filename,
      output_audio: `/users/${user.email}/outputs/${annotation.mp3_filename}`,
      output_image: `/users/${user.email}/uploads/${annotation.image_filename}`,
      created_at: annotation.created_at
    }));

    res.json({ annotations: formattedAnnotations });
  } catch (error) {
    console.error('Error getting image annotations:', error);
    res.status(500).json({ error: 'Failed to get image annotations' });
  }
});

// Legacy endpoint removed - using /api/annotation/id/:annotationId instead

// Delete annotation by ID (new endpoint)
app.delete('/api/annotation/id/:annotationId', async (req, res) => {
  try {
    const annotationId = parseInt(req.params.annotationId);
    const result = await db.deleteAnnotationById(annotationId);
    
    if (result > 0) {
      res.json({ success: true, message: 'Annotation deleted successfully' });
    } else {
      res.status(404).send('Annotation not found');
    }
  } catch (error) {
    console.error('Error deleting annotation:', error);
    res.status(500).send('Failed to delete annotation');
  }
});

// Toggle favorite status
app.put('/api/image/:imageId/favorite', async (req, res) => {
  try {
    const imageId = parseInt(req.params.imageId);
    const result = await db.toggleFavorite(imageId);
    
    if (result > 0) {
      res.json({ success: true, message: 'Favorite status updated' });
    } else {
      res.status(404).send('Image not found');
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).send('Failed to update favorite status');
  }
});

// Update image tags
app.put('/api/image/:imageId/tags', async (req, res) => {
  try {
    const imageId = parseInt(req.params.imageId);
    const { tags } = req.body;
    
    if (tags === undefined) {
      return res.status(400).send('Tags are required');
    }
    
    const result = await db.updateImageTags(imageId, tags);
    
    if (result > 0) {
      res.json({ success: true, message: 'Tags updated successfully' });
    } else {
      res.status(404).send('Image not found');
    }
  } catch (error) {
    console.error('Error updating tags:', error);
    res.status(500).send('Failed to update tags');
  }
});

// Delete image with cleanup
app.delete('/api/image/:imageId', async (req, res) => {
  try {
    const imageId = parseInt(req.params.imageId);
    const user = await db.getUser(DEFAULT_USER);
    
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Get image info before deletion
    const imageInfo = await db.getImageById(imageId);
    if (!imageInfo) {
      return res.status(404).send('Image not found');
    }

    // Get all annotations for this image
    const imageAnnotations = await db.getImageAnnotations(user.id, imageInfo.filename);
    
    // Delete associated MP3 files
    for (const annotation of imageAnnotations) {
      const mp3Path = path.join(userManager.getUserOutputsDir(user.email), annotation.mp3_filename);
      if (fs.existsSync(mp3Path)) {
        fs.unlinkSync(mp3Path);
      }
    }

    // Delete annotations from database
    for (const annotation of imageAnnotations) {
      await db.deleteAnnotationById(annotation.id);
    }

    // Delete the image file
    const imagePath = path.join(userManager.getUserUploadsDir(user.email), imageInfo.filename);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Soft delete the image from database
    const result = await db.softDeleteImage(imageId);
    
    if (result > 0) {
      res.json({ 
        success: true, 
        message: `Image deleted successfully. Removed ${imageAnnotations.length} annotation${imageAnnotations.length > 1 ? 's' : ''}.` 
      });
    } else {
      res.status(404).send('Image not found');
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).send('Failed to delete image');
  }
});

// Get images by session
app.get('/api/session/:sessionId/images', async (req, res) => {
  try {
    const user = await db.getUser(DEFAULT_USER);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const sessionId = parseInt(req.params.sessionId);
    const images = await db.getImagesBySession(user.id, sessionId);
    
    res.json({ images: images.map(img => ({
      id: img.id,
      filename: img.filename,
      original_filename: img.original_filename,
      upload_time: img.upload_time,
      session_id: img.session_id,
      is_favorite: img.is_favorite,
      tags: img.tags,
      url: `/users/${user.email}/uploads/${img.filename}`
    })) });
  } catch (error) {
    console.error('Error getting session images:', error);
    res.status(500).send('Failed to get session images');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`PicVoice multi-user prototype running at http://0.0.0.0:${port}`);
  console.log(`Access from iPad: http://[YOUR_COMPUTER_IP]:${port}`);
  console.log(`Current user: ${DEFAULT_USER}`);
});

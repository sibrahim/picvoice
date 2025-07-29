
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

// Enable CORS for iPad access
app.use(cors());
app.use(express.static('public'));
app.use('/outputs', express.static('outputs'));
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/create-video', upload.fields([{ name: 'image' }, { name: 'audio' }]), (req, res) => {
  const image = req.files['image'][0];
  const audio = req.files['audio'][0];
  const outputType = req.body.output || 'mp4'; // mp4 or mp3

  // Validate
  if (!image || !audio) {
    return res.status(400).send('Image and audio are required.');
  }
  if (!image.mimetype.startsWith('image/') || !audio.mimetype.startsWith('audio/')) {
    return res.status(400).send('Invalid file types.');
  }

  const baseName = path.basename(image.originalname, path.extname(image.originalname)).replace(/\s+/g, '_');
  const timestamp = Date.now();
  const outputFileName = `${baseName}_${timestamp}`;

  if (outputType === 'mp3') {
    const mp3Path = `outputs/${outputFileName}.mp3`;
    const imageCopyPath = `outputs/${outputFileName}${path.extname(image.originalname)}`;

    const cmd = spawn('ffmpeg', [
      '-i', audio.path,
      '-vn',
      '-ar', '44100',
      '-ac', '2',
      '-b:a', '192k',
      '-y', mp3Path
    ]);

    cmd.stderr.on('data', data => console.error(`stderr: ${data}`));

    cmd.on('close', code => {
      if (code !== 0) {
        return res.status(500).send('ffmpeg mp3 conversion failed');
      }
      // Copy image file to outputs with same base name
      fs.copyFile(image.path, imageCopyPath, err => {
        if (err) {
          console.error('Image copy failed:', err);
          return res.status(500).send('Image copy failed');
        }
        res.json({ output_audio: mp3Path, output_image: imageCopyPath });
      });
    });

  } else {
    // default to mp4 video
    const outputVideo = `outputs/${outputFileName}.mp4`;

    const cmd = spawn('ffmpeg', [
      '-loop', '1',
      '-i', image.path,
      '-i', audio.path,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-pix_fmt', 'yuv420p',
      '-y', outputVideo
    ]);

    cmd.stderr.on('data', data => console.error(`stderr: ${data}`));

    cmd.on('close', code => {
      if (code !== 0) {
        return res.status(500).send('ffmpeg mp4 conversion failed');
      }
      res.json({ output: outputVideo });
    });

    setTimeout(() => {
      cmd.kill('SIGKILL');
    }, 30000);
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`PicVoice prototype running at http://0.0.0.0:${port}`);
  console.log(`Access from iPad: http://[YOUR_COMPUTER_IP]:${port}`);
});

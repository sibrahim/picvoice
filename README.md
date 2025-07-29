# PicVoice Prototype

A web application for creating voice annotations on photos. Users can select images, record audio descriptions, and generate videos or audio files with their annotations.

## Features

- 📸 **Photo Selection**: Upload and browse through multiple images
- 🎤 **Voice Recording**: Record audio annotations directly in the browser
- 🎬 **Video Generation**: Create MP4 videos with photos and audio
- 🎵 **Audio Export**: Generate MP3 files with image thumbnails
- 📱 **iPad Support**: Touch-friendly interface with swipe gestures
- ⌨️ **Keyboard Shortcuts**: Full keyboard navigation support

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- FFmpeg (for video/audio processing)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd picvoice
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Access the application**:
   - Local: http://localhost:3000
   - Network: http://[YOUR_IP]:3000 (for iPad access)

## Usage

### Basic Workflow

1. **Select Images**: Click "Choose Files" to select a folder of images
2. **Navigate**: Use Previous/Next buttons or arrow keys to browse images
3. **Record**: Click "Start Record" (or press Spacebar) to begin recording
4. **Stop**: Click "Stop Record" (or press Q) to finish recording
5. **Download**: Access your generated files from the Output Preview

### Keyboard Shortcuts

- **Spacebar**: Start/Stop recording
- **Q**: Stop recording
- **Left Arrow**: Previous image
- **Right Arrow**: Next image

### iPad Features

- **Touch Gestures**: Swipe left/right to navigate images
- **Mobile Optimized**: Responsive design for tablet use
- **Photo Library Access**: Direct access to iPad photo library

## API Endpoints

### POST `/create-video`
Creates a video or audio file from uploaded image and audio.

**Parameters**:
- `image`: Image file (multipart/form-data)
- `audio`: Audio file (multipart/form-data)
- `output`: Output type ('mp4' or 'mp3', optional)

**Response**:
```json
{
  "output": "outputs/filename_timestamp.mp4"
}
```

## Project Structure

```
picvoice/
├── public/                 # Frontend files
│   ├── index.html         # Main application page
│   ├── script.js          # Frontend JavaScript
│   ├── style.css          # Application styles
│   ├── history.html       # History page
│   └── library.html       # Library page
├── server.js              # Express server
├── package.json           # Dependencies and scripts
├── start-ipad.sh          # iPad setup script
└── README.md             # This file
```

## Development

### Running for iPad Access

Use the provided script for easy iPad setup:

```bash
./start-ipad.sh
```

This script will:
- Check for Node.js installation
- Install dependencies if needed
- Display your computer's IP address
- Start the server with network access

### Network Configuration

The server is configured to:
- Listen on all network interfaces (`0.0.0.0`)
- Enable CORS for cross-origin requests
- Support mobile viewport and touch gestures

## Dependencies

- **Express**: Web server framework
- **Multer**: File upload handling
- **CORS**: Cross-origin resource sharing
- **FFmpeg**: Video/audio processing (system dependency)

## Browser Support

- Chrome/Chromium (recommended)
- Firefox
- Safari (iOS/iPadOS)
- Edge

## License

This project is a prototype. Please check with the project maintainers for licensing information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Common Issues

**FFmpeg not found**: Install FFmpeg on your system
- Ubuntu/Debian: `sudo apt install ffmpeg`
- macOS: `brew install ffmpeg`
- Windows: Download from https://ffmpeg.org/

**Port 3000 in use**: Change the port in `server.js`
```javascript
const port = 3001; // or any available port
```

**iPad can't connect**: 
- Ensure both devices are on the same WiFi network
- Check firewall settings
- Verify the IP address is correct

**Recording not working**:
- Ensure microphone permissions are granted
- Try refreshing the page
- Check browser console for errors 

let mediaRecorder, audioChunks = [], audioBlob, imageFiles = [], currentIndex = 0, imageFile = null;
let seconds = 0, timerInterval;
let savedAnnotations = {};
let userImages = [];

// iPad-specific enhancements
const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

// Load user's images on page load
window.addEventListener('load', async () => {
  await loadUserImages();
});

async function loadUserImages() {
  try {
    console.log('Loading user images...');
    const response = await fetch('/api/images');
    const data = await response.json();
    userImages = data.images;
    console.log('Loaded images:', userImages);
    
    if (userImages.length > 0) {
      // Convert image objects to File-like objects for compatibility
      imageFiles = userImages.map(img => ({
        name: img.filename,
        // Create a fake File object with the correct name
        type: 'image/jpeg' // Assume JPEG for now
      }));
      console.log('Converted imageFiles:', imageFiles);
      currentIndex = 0;
      displayImage();
      fetchAnnotations();
    } else {
      console.log('No images found');
    }
  } catch (error) {
    console.error('Error loading user images:', error);
  }
}

// Upload folder of images
document.getElementById('imageInput').addEventListener('change', async (event) => {
  const files = Array.from(event.target.files).filter(file => file.type.startsWith('image/'));
  
  if (files.length === 0) {
    alert('No image files found in the selected folder.');
    return;
  }

  const formData = new FormData();
  files.forEach(file => {
    formData.append('images', file);
  });

  try {
    const response = await fetch('/upload-images', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      alert('Upload failed: ' + errorText);
      return;
    }

    const result = await response.json();
    
    if (result.message) {
      alert(result.message);
      await loadUserImages(); // Reload the user's images
    } else {
      alert('Upload completed successfully!');
      await loadUserImages(); // Reload the user's images
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Upload failed. Please try again.');
  }
});

// Add touch support for iPad
if (isIPad) {
  document.addEventListener('touchstart', handleTouchStart, false);
  document.addEventListener('touchmove', handleTouchMove, false);
}

let xDown = null;
let yDown = null;

function handleTouchStart(evt) {
  const firstTouch = evt.touches[0];
  xDown = firstTouch.clientX;
  yDown = firstTouch.clientY;
}

function handleTouchMove(evt) {
  if (!xDown || !yDown) {
    return;
  }

  const xUp = evt.touches[0].clientX;
  const yUp = evt.touches[0].clientY;

  const xDiff = xDown - xUp;
  const yDiff = yDown - yUp;

  if (Math.abs(xDiff) > Math.abs(yDiff)) {
    if (xDiff > 0) {
      // Swipe left - next image
      if (imageFiles.length > 0 && currentIndex < imageFiles.length - 1) {
        currentIndex++;
        displayImage();
      }
    } else {
      // Swipe right - previous image
      if (imageFiles.length > 0 && currentIndex > 0) {
        currentIndex--;
        displayImage();
      }
    }
  }

  xDown = null;
  yDown = null;
}

function updateNavButtons() {
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === imageFiles.length - 1;
  prevBtn.style.opacity = currentIndex === 0 ? 0.5 : 1;
  nextBtn.style.opacity = currentIndex === imageFiles.length - 1 ? 0.5 : 1;
}

function displayImage() {
  console.log('displayImage called, imageFiles.length:', imageFiles.length);
  if (imageFiles.length === 0) {
    console.log('No image files to display');
    document.getElementById('imageFilename').innerText = '';
    return;
  }
  imageFile = imageFiles[currentIndex];
  console.log('Current imageFile:', imageFile);
  document.getElementById('imageFilename').innerText = imageFile.name || '';
  
  // Create image element with user-specific path and cache-busting
  const img = document.createElement('img');
  const cacheBuster = Date.now() + Math.random(); // More unique cache-busting parameter
  img.src = `/users/testuser@gmail.com/uploads/${imageFile.name}?t=${cacheBuster}`;
  console.log('Image src:', img.src);
  
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = '';
  preview.appendChild(img);
  updateNavButtons();
  loadAnnotation(imageFile.name);
}

async function loadAnnotation(filename) {
  const outputDiv = document.getElementById('outputPreview');
  outputDiv.innerHTML = '';
  document.getElementById('status').innerText = '';

  try {
    const response = await fetch(`/api/image/${encodeURIComponent(filename)}/annotations`);
    const data = await response.json();
    
    if (data.annotations && data.annotations.length > 0) {
      // Use the most recent annotation
      const annotation = data.annotations[0];
      let html = '';
      html += `<audio controls src="${annotation.output_audio}" class="centered"></audio><br>`;
      html += `<a href="${annotation.output_audio}" download>Download MP3</a><br>`;
      html += `<a href="${annotation.output_image}" download>Download Image</a>`;
      document.getElementById('status').innerText = `✅ Previously Annotated (${data.annotations.length} annotation${data.annotations.length > 1 ? 's' : ''})`;
      outputDiv.innerHTML = html;
    }
  } catch (error) {
    console.error('Error loading annotation:', error);
  }
}

function setRecordingState(isRecording) {
  const recordToggleBtn = document.getElementById('recordToggleBtn');
  const recordingStatus = document.getElementById('recordingStatus');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (isRecording) {
    recordToggleBtn.textContent = 'Stop Recording';
    recordToggleBtn.style.backgroundColor = '#ff4444';
    recordingStatus.style.display = 'inline';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  } else {
    recordToggleBtn.textContent = 'Press to Record';
    recordToggleBtn.style.backgroundColor = '#4CAF50';
    recordingStatus.style.display = 'none';
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  }
}

const recordToggleBtn = document.getElementById('recordToggleBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

recordToggleBtn.addEventListener('click', async () => {
  if (!imageFile) {
    alert('Please select an image first.');
    return;
  }

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      seconds = 0;

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        document.getElementById('audioPlayback').src = audioUrl;
        document.getElementById('audioPlayback').style.display = 'block';
        autoCreateOutput();
      };

      mediaRecorder.start();
      timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        document.getElementById('timer').innerText = `${mins}:${secs} / 05:00`;
      }, 1000);
      setRecordingState(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  } else {
    mediaRecorder.stop();
    clearInterval(timerInterval);
    setRecordingState(false);
  }
});

prevBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    displayImage();
  }
});

nextBtn.addEventListener('click', () => {
  if (currentIndex < imageFiles.length - 1) {
    currentIndex++;
    displayImage();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
  if ((event.key === ' ' || event.key === 'Spacebar') && !recordToggleBtn.disabled) {
    event.preventDefault();
    recordToggleBtn.click();
  } else if ((event.key === 'q' || event.key === 'Q') && !recordToggleBtn.disabled) {
    event.preventDefault();
    recordToggleBtn.click();
  } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'PageUp' || event.key === 'PageDown')) {
    // Only allow navigation if not recording
    if (!recordToggleBtn.disabled) {
      if ((event.key === 'ArrowLeft' || event.key === 'PageUp') && !prevBtn.disabled) {
        currentIndex--;
        displayImage();
      } else if ((event.key === 'ArrowRight' || event.key === 'PageDown') && !nextBtn.disabled) {
        currentIndex++;
        displayImage();
      }
    }
  }
});

async function autoCreateOutput() {
  if (!imageFile || !audioBlob) {
    alert("Please select an image and record audio first.");
    return;
  }

  const formData = new FormData();
  
  // Create a File object from the image filename
  const imageResponse = await fetch(`/users/testuser@gmail.com/uploads/${imageFile.name}`);
  const imageBlob = await imageResponse.blob();
  const imageFileObj = new File([imageBlob], imageFile.name, { type: 'image/jpeg' });
  
  formData.append('image', imageFileObj);
  formData.append('audio', audioBlob);
  formData.append('output', 'mp3');

  document.getElementById('status').innerText = 'Creating...';
  document.getElementById('outputPreview').innerHTML = '';

  try {
    const response = await fetch('/create-video', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    const outputDiv = document.getElementById('outputPreview');
    let html = '';

    if (result.output_audio && result.output_image) {
      html += `<audio controls src="${result.output_audio}" class="centered"></audio><br>`;
      html += `<a href="${result.output_audio}" download>Download MP3</a><br>`;
      html += `<a href="${result.output_image}" download>Download Image</a>`;
    }

    document.getElementById('status').innerText = '✅ Done!';
    outputDiv.innerHTML = html;
  } catch (error) {
    console.error('Error creating output:', error);
    document.getElementById('status').innerText = '❌ Error creating output';
  }
}

async function fetchAnnotations() {
  try {
    const response = await fetch('/api/annotations');
    const data = await response.json();
    
    // Convert database annotations to the format expected by the frontend
    savedAnnotations = {};
    data.annotations.forEach(annotation => {
      savedAnnotations[annotation.image_filename] = {
        output_audio: `/users/testuser@gmail.com/outputs/${annotation.mp3_filename}`,
        output_image: `/users/testuser@gmail.com/uploads/${annotation.image_filename}`,
        timestamp: annotation.created_at
      };
    });
  } catch (error) {
    console.error('Error fetching annotations:', error);
  }
  displayImage();
}

// Help modal logic
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const closeHelp = document.getElementById('closeHelp');
const modalCloseBtn = document.getElementById('modalCloseBtn');
helpBtn.addEventListener('click', () => {
  helpModal.style.display = 'block';
});
closeHelp.addEventListener('click', () => {
  helpModal.style.display = 'none';
});
modalCloseBtn.addEventListener('click', () => {
  helpModal.style.display = 'none';
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && helpModal.style.display === 'block') {
    helpModal.style.display = 'none';
  }
});

// Add event listener for the new select image button
const imageInput = document.getElementById('imageInput');
const selectImageBtn = document.getElementById('selectImageBtn');
if (selectImageBtn && imageInput) {
  selectImageBtn.addEventListener('click', () => imageInput.click());
}

// Rotation functionality
const rotateBtn = document.getElementById('rotateBtn');
if (rotateBtn) {
  rotateBtn.addEventListener('click', async () => {
    if (!imageFile || !userImages[currentIndex]) {
      alert('Please select an image first.');
      return;
    }

    const imageId = userImages[currentIndex].id;
    try {
      const response = await fetch(`/api/image/${imageId}/rotate`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        //alert('Image rotated successfully!');
        // Reload the image to show the rotation with fresh cache-busting
        displayImage();
        // Reload user images to get updated rotation data
        await loadUserImages();
      } else {
        const errorText = await response.text();
        alert('Failed to rotate image: ' + errorText);
      }
    } catch (error) {
      console.error('Error rotating image:', error);
      alert('Failed to rotate image. Please try again.');
    }
  });
}

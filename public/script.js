
let mediaRecorder, audioChunks = [], audioBlob, imageFiles = [], currentIndex = 0, imageFile = null;
let seconds = 0, timerInterval;
let savedAnnotations = {};

// iPad-specific enhancements
const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;

document.getElementById('imageInput').addEventListener('change', event => {
  imageFiles = Array.from(event.target.files).filter(file => file.type.startsWith('image/'));
  currentIndex = 0;
  if (imageFiles.length > 0) {
    displayImage();
    fetchAnnotations();
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
  if (imageFiles.length === 0) {
    document.getElementById('imageFilename').innerText = '';
    return;
  }
  imageFile = imageFiles[currentIndex];
  document.getElementById('imageFilename').innerText = imageFile.name || '';
  const img = document.createElement('img');
  img.src = URL.createObjectURL(imageFile);
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = '';
  preview.appendChild(img);
  updateNavButtons();
  loadAnnotation(imageFile.name);
}

function loadAnnotation(filename) {
  const outputDiv = document.getElementById('outputPreview');
  outputDiv.innerHTML = '';
  document.getElementById('status').innerText = '';

  if (savedAnnotations[filename]) {
    const a = savedAnnotations[filename];
    let html = '';
    html += `<audio controls src="${a.output_audio}" class="centered"></audio><br>`;
    html += `<a href="${a.output_audio}" download>Download MP3</a><br>`;
    html += `<a href="${a.output_image}" download>Download Image</a>`;
    document.getElementById('status').innerText = '✅ Previously Annotated';
    outputDiv.innerHTML = html;
  }
}

document.getElementById('prevBtn').addEventListener('click', () => {
  if (imageFiles.length === 0 || currentIndex === 0) return;
  currentIndex--;
  displayImage();
});

document.getElementById('nextBtn').addEventListener('click', () => {
  if (imageFiles.length === 0 || currentIndex === imageFiles.length - 1) return;
  currentIndex++;
  displayImage();
});

const recordToggleBtn = document.getElementById('recordToggleBtn');
const recordingStatus = document.getElementById('recordingStatus');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const selectImageBtn = document.getElementById('selectImageBtn');

function setRecordingState(isRecording) {
  if (recordToggleBtn) {
    recordToggleBtn.disabled = false;
    recordToggleBtn.textContent = isRecording ? 'Press to Stop' : 'Press to Record';
    recordToggleBtn.classList.toggle('recording', isRecording);
  }
  if (recordingStatus) {
    recordingStatus.style.display = isRecording ? 'inline' : 'none';
  }
  prevBtn.disabled = isRecording || currentIndex === 0;
  nextBtn.disabled = isRecording || currentIndex === imageFiles.length - 1;
  prevBtn.style.opacity = (isRecording || currentIndex === 0) ? 0.5 : 1;
  nextBtn.style.opacity = (isRecording || currentIndex === imageFiles.length - 1) ? 0.5 : 1;
  if (selectImageBtn) {
    selectImageBtn.disabled = isRecording;
    selectImageBtn.style.opacity = isRecording ? 0.5 : 1;
  }
}

recordToggleBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    // Stop recording
    mediaRecorder.stop();
    clearInterval(timerInterval);
    setRecordingState(false);
  } else {
    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        clearInterval(timerInterval);
        setRecordingState(false);
        await autoCreateOutput();
      };
      mediaRecorder.start();
      document.getElementById('timer').innerText = "00:00 / 05:00";
      seconds = 0;
      timerInterval = setInterval(() => {
        seconds++;
        if (seconds >= 300) {
          mediaRecorder.stop();
        }
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        document.getElementById('timer').innerText = `${mins}:${secs} / 05:00`;
      }, 1000);
      setRecordingState(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
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
  formData.append('image', imageFile);
  formData.append('audio', audioBlob);
  formData.append('output', 'mp3');

  document.getElementById('status').innerText = 'Creating...';
  document.getElementById('outputPreview').innerHTML = '';

  const response = await fetch('/create-video', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  const outputDiv = document.getElementById('outputPreview');
  let html = '';

  if (result.output_audio && result.output_image) {
    savedAnnotations[imageFile.name] = result;
    html += `<audio controls src="${result.output_audio}" class="centered"></audio><br>`;
    html += `<a href="${result.output_audio}" download>Download MP3</a><br>`;
    html += `<a href="${result.output_image}" download>Download Image</a>`;
  }

  document.getElementById('status').innerText = '✅ Done!';
  outputDiv.innerHTML = html;
}

async function fetchAnnotations() {
  const res = await fetch('/annotations.json');
  if (res.ok) {
    savedAnnotations = await res.json();
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
if (selectImageBtn && imageInput) {
  selectImageBtn.addEventListener('click', () => imageInput.click());
}

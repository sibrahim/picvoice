// Management page functionality
let images = [];
let annotations = {};
let currentImage = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;

// Simple test to verify JavaScript is loading
console.log('Management.js loaded successfully');
alert('Management page JavaScript loaded!');

// Load data on page load
window.addEventListener('load', async () => {
  console.log('Management page loaded, starting initialization...');
  
  // Test if DOM elements exist
  const testElements = [
    'imagesGrid',
    'totalImages', 
    'annotatedImages',
    'unannotatedImages',
    'sortSelect',
    'filterSelect',
    'searchInput'
  ];
  
  const missingElements = testElements.filter(id => !document.getElementById(id));
  if (missingElements.length > 0) {
    console.error('Missing DOM elements:', missingElements);
    return;
  }
  
  console.log('All required DOM elements found, loading data...');
  
  await loadImages();
  await loadAnnotations();
  renderImages();
  updateStats();
  
  console.log('Management page initialization complete');
});

// Load user's images
async function loadImages() {
  try {
    console.log('Loading images for management page...');
    const response = await fetch('/api/all-images');
    const data = await response.json();
    console.log('Raw images data:', data);
    images = data.images.map(img => ({
      id: img.id,
      filename: img.filename,
      name: img.original_filename || img.filename,
      url: img.url || `/users/testuser@gmail.com/uploads/${img.filename}`,
      upload_time: img.upload_time,
      session_id: img.session_id,
      is_favorite: img.is_favorite,
      tags: img.tags,
      hasAnnotation: false,
      annotationCount: 0
    }));
    console.log('Processed images:', images);
  } catch (error) {
    console.error('Error loading images:', error);
  }
}

// Load user's annotations
async function loadAnnotations() {
  try {
    console.log('Loading annotations for management page...');
    const response = await fetch('/api/annotations');
    const data = await response.json();
    console.log('Raw annotations data:', data);
    
    annotations = {};
    data.annotations.forEach(annotation => {
      if (!annotations[annotation.image_filename]) {
        annotations[annotation.image_filename] = [];
      }
      annotations[annotation.image_filename].push({
        id: annotation.id,
        mp3_filename: annotation.mp3_filename,
        mp3_url: `/users/testuser@gmail.com/outputs/${annotation.mp3_filename}`,
        created_at: annotation.created_at
      });
    });
    console.log('Processed annotations:', annotations);
    
    // Update image annotation status
    images.forEach(image => {
      image.annotationCount = annotations[image.filename] ? annotations[image.filename].length : 0;
      image.hasAnnotation = image.annotationCount > 0;
    });
    console.log('Updated images with annotation status:', images);
  } catch (error) {
    console.error('Error loading annotations:', error);
  }
}

// Render images grid
function renderImages() {
  console.log('Rendering images grid...');
  const grid = document.getElementById('imagesGrid');
  const sortBy = document.getElementById('sortSelect').value;
  const filterBy = document.getElementById('filterSelect').value;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  
  console.log('Filter/sort settings:', { sortBy, filterBy, searchTerm });
  console.log('Total images to render:', images.length);
  
  // Filter and sort images
  let filteredImages = images.filter(image => {
    const matchesSearch = image.name.toLowerCase().includes(searchTerm);
    const matchesFilter = filterBy === 'all' || 
      (filterBy === 'annotated' && image.hasAnnotation) ||
      (filterBy === 'unannotated' && !image.hasAnnotation);
    
    return matchesSearch && matchesFilter;
  });
  
  console.log('Filtered images:', filteredImages.length);
  
  // Sort images
  filteredImages.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'date':
        return new Date(b.upload_time || 0) - new Date(a.upload_time || 0);
      case 'annotated':
        return (b.hasAnnotation ? 1 : 0) - (a.hasAnnotation ? 1 : 0);
      default:
        return 0;
    }
  });
  
  // Generate HTML
  const html = filteredImages.map(image => `
    <div class="image-card" onclick="openImageModal('${image.filename}')">
      <img src="${image.url}" alt="${image.name}" />
      <div class="image-card-info">
        <div class="image-card-name">${image.name}</div>
        <div class="image-card-status ${image.hasAnnotation ? 'status-annotated' : 'status-unannotated'}">
          <div class="status-icon"></div>
          ${image.hasAnnotation ? `${image.annotationCount} Annotation${image.annotationCount > 1 ? 's' : ''}` : 'No Annotations'}
        </div>
      </div>
    </div>
  `).join('');
  
  console.log('Generated HTML length:', html.length);
  grid.innerHTML = html;
}

// Update statistics
function updateStats() {
  console.log('Updating stats...');
  const total = images.length;
  const annotated = images.filter(img => img.hasAnnotation).length;
  const totalAnnotations = images.reduce((sum, img) => sum + img.annotationCount, 0);
  
  console.log('Stats:', { total, annotated, totalAnnotations });
  
  document.getElementById('totalImages').textContent = `Total Images: ${total}`;
  document.getElementById('annotatedImages').textContent = `Annotated: ${annotated}`;
  document.getElementById('unannotatedImages').textContent = `Total Annotations: ${totalAnnotations}`;
}

// Open image detail modal
function openImageModal(filename) {
  currentImage = images.find(img => img.filename === filename);
  if (!currentImage) return;
  
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalImageName = document.getElementById('modalImageName');
  const annotationStatus = document.getElementById('annotationStatus');
  const addBtn = document.getElementById('addAnnotation');
  
  // Set image
  modalImage.src = currentImage.url;
  modalImageName.textContent = currentImage.name;
  
  // Set annotation status
  const imageAnnotations = annotations[currentImage.filename] || [];
  if (imageAnnotations.length > 0) {
    annotationStatus.className = 'annotation-status annotated';
    annotationStatus.textContent = `✅ ${imageAnnotations.length} Annotation${imageAnnotations.length > 1 ? 's' : ''}`;
    addBtn.textContent = 'Add Another Annotation';
  } else {
    annotationStatus.className = 'annotation-status unannotated';
    annotationStatus.textContent = '❌ No annotations';
    addBtn.textContent = 'Add Annotation';
  }
  
  // Render annotations list
  renderAnnotationsList(imageAnnotations);
  
  modal.style.display = 'block';
}

// Close image modal
function closeImageModal() {
  document.getElementById('imageModal').style.display = 'none';
  currentImage = null;
}

// Render annotations list
function renderAnnotationsList(annotations) {
  const controlsDiv = document.getElementById('annotation-controls');
  const playerDiv = document.getElementById('annotationPlayer');
  
  if (annotations.length === 0) {
    controlsDiv.innerHTML = '<p>No annotations yet. Click "Add Annotation" to record one.</p>';
    playerDiv.style.display = 'none';
    return;
  }
  
  // Create annotations list
  const annotationsList = document.createElement('div');
  annotationsList.className = 'annotations-list';
  
  annotations.forEach((annotation, index) => {
    const annotationItem = document.createElement('div');
    annotationItem.className = 'annotation-item';
    
    const date = new Date(annotation.created_at).toLocaleString();
    
    annotationItem.innerHTML = `
      <div class="annotation-info">
        <span class="annotation-number">#${index + 1}</span>
        <span class="annotation-date">${date}</span>
      </div>
      <div class="annotation-controls-small">
        <button class="btn btn-small btn-primary" onclick="playAnnotation('${annotation.mp3_url}')" title="Play">
          ▶️
        </button>
        <button class="btn btn-small btn-secondary" onclick="downloadAnnotation('${annotation.mp3_url}', '${annotation.mp3_filename}')" title="Download">
          📥
        </button>
        <button class="btn btn-small btn-danger" onclick="deleteAnnotationById(${annotation.id})" title="Delete">
          🗑️
        </button>
      </div>
    `;
    
    annotationsList.appendChild(annotationItem);
  });
  
  // Replace existing controls
  controlsDiv.innerHTML = '';
  controlsDiv.appendChild(annotationsList);
  playerDiv.style.display = 'none';
}

// Play specific annotation
function playAnnotation(mp3Url) {
  const player = document.getElementById('annotationPlayer');
  const audioPlayer = document.getElementById('audioPlayer');
  
  audioPlayer.src = mp3Url;
  player.style.display = 'block';
  audioPlayer.play();
}

// Download specific annotation
function downloadAnnotation(mp3Url, filename) {
  const link = document.createElement('a');
  link.href = mp3Url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Delete specific annotation by ID
async function deleteAnnotationById(annotationId) {
  if (!confirm('Are you sure you want to delete this annotation?')) return;
  
  try {
    const response = await fetch(`/api/annotation/id/${annotationId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Reload data and refresh UI
      await loadAnnotations();
      renderImages();
      updateStats();
      
      // Refresh modal if open
      if (currentImage) {
        const imageAnnotations = annotations[currentImage.filename] || [];
        renderAnnotationsList(imageAnnotations);
        
        // Update status
        const annotationStatus = document.getElementById('annotationStatus');
        const addBtn = document.getElementById('addAnnotation');
        
        if (imageAnnotations.length > 0) {
          annotationStatus.className = 'annotation-status annotated';
          annotationStatus.textContent = `✅ ${imageAnnotations.length} Annotation${imageAnnotations.length > 1 ? 's' : ''}`;
          addBtn.textContent = 'Add Another Annotation';
        } else {
          annotationStatus.className = 'annotation-status unannotated';
          annotationStatus.textContent = '❌ No annotations';
          addBtn.textContent = 'Add Annotation';
        }
      }
      
      alert('Annotation deleted successfully!');
    } else {
      alert('Failed to delete annotation');
    }
  } catch (error) {
    console.error('Error deleting annotation:', error);
    alert('Error deleting annotation');
  }
}

// Open recording modal
function openRecordingModal() {
  if (!currentImage) return;
  
  const modal = document.getElementById('recordingModal');
  const recordingImage = document.getElementById('recordingImage');
  
  recordingImage.src = currentImage.url;
  modal.style.display = 'block';
  
  // Reset recording state
  document.getElementById('recordBtn').style.display = 'inline-block';
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('recordingTimer').textContent = '00:00';
  document.getElementById('recordingStatus').textContent = '';
  document.getElementById('recordingStatus').className = 'recording-status';
}

// Close recording modal
function closeRecordingModal() {
  document.getElementById('recordingModal').style.display = 'none';
  
  // Stop recording if active
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  
  recordingSeconds = 0;
}

// Start recording
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    recordingSeconds = 0;
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      await createAnnotation(audioBlob);
    };
    
    mediaRecorder.start();
    
    // Update UI
    document.getElementById('recordBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'inline-block';
    document.getElementById('recordingStatus').textContent = 'Recording...';
    document.getElementById('recordingStatus').className = 'recording-status recording';
    
    // Start timer
    recordingTimer = setInterval(() => {
      recordingSeconds++;
      const mins = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
      const secs = (recordingSeconds % 60).toString().padStart(2, '0');
      document.getElementById('recordingTimer').textContent = `${mins}:${secs}`;
    }, 1000);
    
  } catch (error) {
    console.error('Error accessing microphone:', error);
    alert('Error accessing microphone. Please check permissions.');
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  
  document.getElementById('recordBtn').style.display = 'inline-block';
  document.getElementById('stopBtn').style.display = 'none';
  document.getElementById('recordingStatus').textContent = 'Processing...';
  document.getElementById('recordingStatus').className = 'recording-status';
}

// Create annotation
async function createAnnotation(audioBlob) {
  try {
    const formData = new FormData();
    
    // Create a File object from the image
    const imageResponse = await fetch(currentImage.url);
    const imageBlob = await imageResponse.blob();
    
    // Use the original image filename (without timestamps)
    const imageFile = new File([imageBlob], currentImage.filename, { type: 'image/jpeg' });
    
    formData.append('image', imageFile);
    formData.append('audio', audioBlob);
    formData.append('output', 'mp3');
    
    const response = await fetch('/create-video', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.output_audio && result.output_image) {
      // Update local data
      if (!annotations[result.image_filename]) {
        annotations[result.image_filename] = [];
      }
      annotations[result.image_filename].push({
        id: Date.now(), // Temporary ID until we reload
        mp3_filename: result.mp3_filename,
        mp3_url: result.output_audio,
        created_at: new Date().toISOString()
      });
      
      currentImage.annotationCount = (currentImage.annotationCount || 0) + 1;
      currentImage.hasAnnotation = true;
      
      // Update UI
      document.getElementById('recordingStatus').textContent = 'Annotation created successfully!';
      document.getElementById('recordingStatus').className = 'recording-status success';
      
      // Close recording modal and refresh
      setTimeout(() => {
        closeRecordingModal();
        closeImageModal();
        loadAnnotations().then(() => {
          renderImages();
          updateStats();
        });
      }, 2000);
      
    } else {
      throw new Error('Invalid response from server');
    }
    
  } catch (error) {
    console.error('Error creating annotation:', error);
    document.getElementById('recordingStatus').textContent = 'Error creating annotation';
    document.getElementById('recordingStatus').className = 'recording-status error';
  }
}

// Upload new images
async function uploadImages(files) {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('images', file);
  });
  
  try {
    const response = await fetch('/upload-images', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`Successfully uploaded ${result.uploaded} images!`);
      await loadImages();
      await loadAnnotations();
      renderImages();
      updateStats();
    } else {
      alert('Upload failed: ' + result.error);
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Upload failed. Please try again.');
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Sort and filter controls
  document.getElementById('sortSelect').addEventListener('change', renderImages);
  document.getElementById('filterSelect').addEventListener('change', renderImages);
  document.getElementById('searchInput').addEventListener('input', renderImages);
  
  // Upload button
  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('imageInput').click();
  });
  
  document.getElementById('imageInput').addEventListener('change', (event) => {
    const files = Array.from(event.target.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      uploadImages(files);
    }
  });
  
  // Modal close buttons
  document.getElementById('closeModal').addEventListener('click', closeImageModal);
  document.getElementById('closeRecordingModal').addEventListener('click', closeRecordingModal);
  
  // Image modal buttons
  document.getElementById('addAnnotation').addEventListener('click', openRecordingModal);
  
  // Recording modal buttons
  document.getElementById('recordBtn').addEventListener('click', startRecording);
  document.getElementById('stopBtn').addEventListener('click', stopRecording);
  
  // Close modals when clicking outside
  window.addEventListener('click', (event) => {
    const imageModal = document.getElementById('imageModal');
    const recordingModal = document.getElementById('recordingModal');
    
    if (event.target === imageModal) {
      closeImageModal();
    }
    if (event.target === recordingModal) {
      closeRecordingModal();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeImageModal();
      closeRecordingModal();
    }
  });
}); 
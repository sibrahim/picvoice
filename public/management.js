// Management page functionality
let images = [];
let annotations = {};
let currentImage = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;

// Load data on page load
window.addEventListener('load', async () => {
  await loadImages();
  await loadAnnotations();
  renderImages();
  updateStats();
  await loadSessions(); // Load sessions for filtering
});

// Load user's images
async function loadImages() {
  try {
    const response = await fetch('/api/all-images');
    const data = await response.json();
    const cacheBuster = Date.now() + Math.random(); // More unique cache-busting parameter
    
    // Load images with tags
    images = await Promise.all(data.images.map(async img => {
      // Get tags for this image
      let imageTags = [];
      try {
        const tagsResponse = await fetch(`/api/images/${img.id}/tags`);
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          imageTags = tagsData.tags || [];
        }
      } catch (error) {
        console.error(`Error loading tags for image ${img.id}:`, error);
      }
      
      return {
        id: img.id,
        filename: img.filename,
        name: img.original_filename || img.filename,
        url: `${img.url || `/users/testuser@gmail.com/uploads/${img.filename}`}?t=${cacheBuster}`,
        upload_time: img.upload_time,
        session_id: img.session_id,
        is_favorite: img.is_favorite,
        tags: imageTags,
        hasAnnotation: false,
        annotationCount: 0,
        ready: img.ready
      };
    }));
  } catch (error) {
    console.error('Error loading images:', error);
  }
}

// Load user's annotations
async function loadAnnotations() {
  try {
    const response = await fetch('/api/annotations');
    const data = await response.json();
    
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
    
    // Update image annotation status
    images.forEach(image => {
      image.annotationCount = annotations[image.filename] ? annotations[image.filename].length : 0;
      image.hasAnnotation = image.annotationCount > 0;
    });
  } catch (error) {
    console.error('Error loading annotations:', error);
  }
}

// Load sessions for filtering
async function loadSessions() {
  try {
    const response = await fetch('/api/sessions');
    const data = await response.json();
    
    const sessionSelect = document.getElementById('sessionFilterSelect');
    sessionSelect.innerHTML = '<option value="all">All Sessions</option>';
    
    data.sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.session_id;
      option.textContent = `Session ${session.session_id} (${session.total_images} images, ${session.ready_images} ready)`;
      sessionSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading sessions:', error);
  }
}

// Load tags (user-defined categorization only)
async function loadTags() {
  try {
    const response = await fetch('/api/tags');
    if (response.ok) {
      const data = await response.json();
      tags = data.tags;
      
      // Update tag filter dropdown
      const tagSelect = document.getElementById('tagFilterSelect');
      tagSelect.innerHTML = '<option value="all">All Tags</option>';
      
      // Update bulk tag assignment dropdown
      const bulkTagSelect = document.getElementById('bulkTagSelect');
      bulkTagSelect.innerHTML = '<option value="">Select tag to assign...</option>';
      
      // Update modal tag assignment dropdown
      const modalTagSelect = document.getElementById('modalTagSelect');
      if (modalTagSelect) {
        modalTagSelect.innerHTML = '<option value="">Select tag to add...</option>';
      }
      
      tags.forEach(tag => {
        // Add to filter dropdown
        const filterOption = document.createElement('option');
        filterOption.value = tag.id;
        filterOption.textContent = tag.name;
        tagSelect.appendChild(filterOption);
        
        // Add to bulk assignment dropdown
        const bulkOption = document.createElement('option');
        bulkOption.value = tag.id;
        bulkOption.textContent = tag.name;
        bulkTagSelect.appendChild(bulkOption);
        
        // Add to modal dropdown
        if (modalTagSelect) {
          const modalOption = document.createElement('option');
          modalOption.value = tag.id;
          modalOption.textContent = tag.name;
          modalTagSelect.appendChild(modalOption);
        }
      });
      
      // Render tag list
      renderTagList();
    }
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

// Render tag list
function renderTagList() {
  const tagList = document.getElementById('tagList');
  if (!tagList) return;
  
  const html = tags.map(tag => `
    <div class="tag-item" data-tag-id="${tag.id}">
      <div class="tag-color" style="background-color: ${tag.color}"></div>
      <span class="tag-name">${tag.name}</span>
      <button class="tag-delete" onclick="deleteTag(${tag.id})">×</button>
    </div>
  `).join('');
  
  tagList.innerHTML = html;
}

// Create new tag
async function createTag() {
  const nameInput = document.getElementById('newTagName');
  const colorInput = document.getElementById('newTagColor');
  
  const name = nameInput.value.trim();
  const color = colorInput.value;
  
  if (!name) {
    alert('Please enter a tag name');
    return;
  }
  
  try {
    const response = await fetch('/api/tags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, color })
    });
    
    if (response.ok) {
      // Clear input
      nameInput.value = '';
      
      // Reload tags
      await loadTags();
      
      alert('Tag created successfully!');
    } else {
      const errorText = await response.text();
      alert('Failed to create tag: ' + errorText);
    }
  } catch (error) {
    console.error('Error creating tag:', error);
    alert('Failed to create tag. Please try again.');
  }
}

// Delete tag
async function deleteTag(tagId) {
  if (!confirm('Are you sure you want to delete this tag? This will remove it from all images.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/tags/${tagId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Remove tag from local array
      tags = tags.filter(tag => tag.id !== tagId);
      
      // Reload tag list display
      renderTagList();
      
      // Refresh all tag dropdowns
      await loadTags();
      
      // Reload images to update tag displays
      await loadImages();
      
      // Clean up any references to deleted tags in the images array
      images.forEach(image => {
        if (image.tags) {
          image.tags = image.tags.filter(tag => tag.id !== tagId);
        }
      });
      
      renderImages();
      updateStats();
      
      // If modal is open, refresh the current image's tags
      if (currentImage) {
        await loadImageTagsForModal(currentImage.id);
      }
      
      alert('Tag deleted successfully!');
    } else {
      const errorText = await response.text();
      alert('Failed to delete tag: ' + errorText);
    }
  } catch (error) {
    console.error('Error deleting tag:', error);
    alert('Failed to delete tag. Please try again.');
  }
}

// Toggle favorite
async function toggleFavorite(imageId) {
  try {
    const response = await fetch(`/api/images/${imageId}/favorite`, {
      method: 'POST'
    });
    
    if (response.ok) {
      // Reload images to update favorite status
      await loadImages();
      renderImages();
      updateStats();
    } else {
      const errorText = await response.text();
      alert('Failed to update favorite status: ' + errorText);
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    alert('Failed to update favorite status. Please try again.');
  }
}

// Assign tag to multiple selected images
async function assignTagToSelectedImages() {
  const selectedIds = getSelectedImageIds();
  const tagId = document.getElementById('bulkTagSelect').value;
  
  if (selectedIds.length === 0) {
    alert('Please select at least one image.');
    return;
  }
  
  if (!tagId) {
    alert('Please select a tag to assign.');
    return;
  }
  
  try {
    let successCount = 0;
    let failedCount = 0;
    
    // Assign tag to each selected image
    for (const imageId of selectedIds) {
      try {
        const response = await fetch(`/api/images/${imageId}/tags/${tagId}`, {
          method: 'POST'
        });
        
        if (response.ok) {
          successCount++;
        } else {
          failedCount++;
          console.error(`Failed to assign tag to image ${imageId}:`, await response.text());
        }
      } catch (error) {
        failedCount++;
        console.error(`Error assigning tag to image ${imageId}:`, error);
      }
    }
    
    // Show results
    if (failedCount === 0) {
      alert(`Successfully assigned tag to ${successCount} image${successCount > 1 ? 's' : ''}!`);
    } else {
      alert(`Assigned tag to ${successCount} image${successCount > 1 ? 's' : ''}, but failed for ${failedCount} image${failedCount > 1 ? 's' : ''}.`);
    }
    
    // Reload data and refresh UI
    await loadImages();
    renderImages();
    updateStats();
    
    // Deselect all after update
    deselectAllImages();
    
    // Reset tag select
    document.getElementById('bulkTagSelect').value = '';
    
  } catch (error) {
    console.error('Error during bulk tag assignment:', error);
    alert('An error occurred during tag assignment. Please try again.');
  }
}

// Add tag to single image (from modal)
async function addTagToImage(imageId) {
  const tagId = document.getElementById('modalTagSelect').value;
  
  if (!tagId) {
    alert('Please select a tag to add.');
    return;
  }
  
  try {
    const response = await fetch(`/api/images/${imageId}/tags/${tagId}`, {
      method: 'POST'
    });
    
    if (response.ok) {
      // Reload image tags in modal
      await loadImageTagsForModal(imageId);
      
      // Reload main data
      await loadImages();
      renderImages();
      updateStats();
      
      alert('Tag added successfully!');
    } else {
      const errorText = await response.text();
      alert('Failed to add tag: ' + errorText);
    }
  } catch (error) {
    console.error('Error adding tag to image:', error);
    alert('Failed to add tag. Please try again.');
  }
}

// Remove tag from image
async function removeTagFromImage(imageId, tagId) {
  try {
    const response = await fetch(`/api/images/${imageId}/tags/${tagId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Reload image tags in modal
      await loadImageTagsForModal(imageId);
      
      // Reload main data
      await loadImages();
      renderImages();
      updateStats();
      
      alert('Tag removed successfully!');
    } else {
      const errorText = await response.text();
      alert('Failed to remove tag: ' + errorText);
    }
  } catch (error) {
    console.error('Error removing tag from image:', error);
    alert('Failed to remove tag. Please try again.');
  }
}

// Load image tags for modal display
async function loadImageTagsForModal(imageId) {
  try {
    const response = await fetch(`/api/images/${imageId}/tags`);
    if (response.ok) {
      const data = await response.json();
      renderImageTagsInModal(data.tags);
    }
  } catch (error) {
    console.error('Error loading image tags for modal:', error);
  }
}

// Render image tags in modal
function renderImageTagsInModal(imageTags) {
  const currentTagsDiv = document.getElementById('currentImageTags');
  if (!currentTagsDiv) return;
  
  if (imageTags.length === 0) {
    currentTagsDiv.innerHTML = '<span class="no-tags">No tags assigned</span>';
    return;
  }
  
  // Filter out any tags that no longer exist
  const validTags = imageTags.filter(tag => tags.some(currentTag => currentTag.id === tag.id));
  
  if (validTags.length === 0) {
    currentTagsDiv.innerHTML = '<span class="no-tags">No tags assigned</span>';
    return;
  }
  
  const html = validTags.map(tag => `
    <span class="image-tag" style="background-color: ${tag.color}20; border-color: ${tag.color}; color: ${tag.color};">
      ${tag.name}
      <button class="tag-remove" onclick="removeTagFromImage(${currentImage.id}, ${tag.id})" title="Remove tag">×</button>
    </span>
  `).join('');
  
  currentTagsDiv.innerHTML = html;
}

// Get selected image IDs
function getSelectedImageIds() {
  const checkboxes = document.querySelectorAll('.image-checkbox:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.dataset.imageId));
}

// Update selection count display
function updateSelectionCount() {
  const selectedCount = getSelectedImageIds().length;
  const selectionCountElement = document.getElementById('selectionCount');
  if (selectionCountElement) {
    selectionCountElement.textContent = `${selectedCount} image${selectedCount !== 1 ? 's' : ''} selected`;
  }
}

// Select all images
function selectAllImages() {
  const checkboxes = document.querySelectorAll('.image-checkbox');
  checkboxes.forEach(cb => cb.checked = true);
  updateSelectionCount();
}

// Deselect all images
function deselectAllImages() {
  const checkboxes = document.querySelectorAll('.image-checkbox');
  checkboxes.forEach(cb => cb.checked = false);
  updateSelectionCount();
}

// Update ready flag for selected images
async function updateSelectedImagesReady(ready) {
  const selectedIds = getSelectedImageIds();
  
  if (selectedIds.length === 0) {
    alert('Please select at least one image.');
    return;
  }
  
  try {
    const response = await fetch('/api/images/ready', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageIds: selectedIds,
        ready: ready
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      alert(result.message);
      
      // Reload data and refresh UI
      await loadImages();
      await loadAnnotations();
      renderImages();
      updateStats();
      
      // Deselect all after update
      deselectAllImages();
    } else {
      const errorText = await response.text();
      alert('Failed to update ready flags: ' + errorText);
    }
  } catch (error) {
    console.error('Error updating ready flags:', error);
    alert('Failed to update ready flags. Please try again.');
  }
}

// Render images grid
function renderImages() {
  const grid = document.getElementById('imagesGrid');
  const sortBy = document.getElementById('sortSelect').value;
  const filterBy = document.getElementById('filterSelect').value;
  const readyFilter = document.getElementById('readyFilterSelect').value;
  const favoriteFilter = document.getElementById('favoriteFilterSelect').value;
  const tagFilter = document.getElementById('tagFilterSelect').value;
  const sessionFilter = document.getElementById('sessionFilterSelect').value;
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  
  // Filter and sort images
  // Note: We use database columns for simple flags (ready, is_favorite) and 
  // annotations table for annotation status, while tags are for user-defined categorization
  let filteredImages = images.filter(image => {
    const matchesSearch = image.name.toLowerCase().includes(searchTerm);
    const matchesFilter = filterBy === 'all' || 
      (filterBy === 'annotated' && image.hasAnnotation) ||
      (filterBy === 'unannotated' && !image.hasAnnotation);
    const matchesReady = readyFilter === 'all' || 
      (filterBy === 'ready' && image.ready) ||
      (filterBy === 'not-ready' && !image.ready);
    const matchesFavorite = favoriteFilter === 'all' || 
      (favoriteFilter === 'favorites' && image.is_favorite) ||
      (favoriteFilter === 'not-favorites' && !image.is_favorite);
    const matchesTag = tagFilter === 'all' || 
      (image.tags && image.tags.some(tag => tag.id.toString() === tagFilter));
    const matchesSession = sessionFilter === 'all' || 
      image.session_id.toString() === sessionFilter;
    
    return matchesSearch && matchesFilter && matchesReady && matchesFavorite && matchesTag && matchesSession;
  });
  
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
  
  // Generate HTML with checkboxes, favorite stars, and ready status
  const html = filteredImages.map(image => `
    <div class="image-card" onclick="openImageModal('${image.filename}')">
      <div class="image-card-checkbox">
        <input type="checkbox" class="image-checkbox" data-image-id="${image.id}" onclick="event.stopPropagation();">
      </div>
      <button class="favorite-star ${image.is_favorite ? 'favorited' : ''}" 
              onclick="event.stopPropagation(); toggleFavorite(${image.id})">
        ${image.is_favorite ? '★' : '☆'}
      </button>
      <img src="${image.url}" alt="${image.name}" />
      <div class="image-card-info">
        <div class="image-card-name">${image.name}</div>
        <div class="image-card-status ${image.hasAnnotation ? 'status-annotated' : 'status-unannotated'}">
          <div class="status-icon"></div>
          ${image.hasAnnotation ? `${image.annotationCount} Annotation${image.annotationCount > 1 ? 's' : ''}` : 'No Annotations'}
        </div>
        <div class="ready-status ${image.ready ? 'ready' : 'not-ready'}">
          ${image.ready ? '✅ Ready' : '⏳ Not Ready'}
        </div>
        ${image.tags && image.tags.length > 0 ? `
          <div class="image-tags">
            ${image.tags
              .filter(tag => tags.some(currentTag => currentTag.id === tag.id)) // Only show tags that still exist
              .map(tag => `
                <span class="image-tag" style="background-color: ${tag.color}20; border-color: ${tag.color}; color: ${tag.color};">
                  ${tag.name}
                </span>
              `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
  
  grid.innerHTML = html;
  
  // Add event listeners to checkboxes for selection count updates
  const checkboxes = grid.querySelectorAll('.image-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectionCount);
  });
}

// Update statistics
function updateStats() {
  const total = images.length;
  const annotated = images.filter(img => img.hasAnnotation).length;
  const totalAnnotations = images.reduce((sum, img) => sum + img.annotationCount, 0);
  
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
  
  // Set image with cache-busting
  const cacheBuster = Date.now() + Math.random();
  modalImage.src = `${currentImage.url.split('?')[0]}?t=${cacheBuster}`;
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
  
  // Load and display image tags
  loadImageTagsForModal(currentImage.id);
  
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
  
  // Reverse the annotations array to show most recent first
  const reversedAnnotations = [...annotations].reverse();
  
  reversedAnnotations.forEach((annotation, index) => {
    const annotationItem = document.createElement('div');
    annotationItem.className = 'annotation-item';
    
    const date = new Date(annotation.created_at).toLocaleString();
    
    annotationItem.innerHTML = `
      <div class="annotation-info">
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

// Delete image with confirmation
async function deleteImage(imageId) {
  if (!confirm('Are you sure you want to delete this image? This will also delete all associated annotations and cannot be undone.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/image/${imageId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      const result = await response.json();
      alert('Image deleted successfully!');
      
      // Reload data and refresh UI
      await loadImages();
      await loadAnnotations();
      renderImages();
      updateStats();
      
      // Close modal if it's open
      closeImageModal();
    } else {
      const errorText = await response.text();
      alert('Failed to delete image: ' + errorText);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    alert('Failed to delete image. Please try again.');
  }
}

// Delete multiple selected images
async function deleteSelectedImages() {
  const selectedIds = getSelectedImageIds();
  
  if (selectedIds.length === 0) {
    alert('Please select at least one image to delete.');
    return;
  }

  const count = selectedIds.length;
  const confirmMessage = `Are you sure you want to delete ${count} selected image${count > 1 ? 's' : ''}? This will also delete all associated annotations and MP3 files.`;
  
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    let deletedCount = 0;
    let failedCount = 0;

    // Delete images one by one
    for (const imageId of selectedIds) {
      try {
        const response = await fetch(`/api/image/${imageId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          deletedCount++;
        } else {
          failedCount++;
          console.error(`Failed to delete image ${imageId}:`, await response.text());
        }
      } catch (error) {
        failedCount++;
        console.error(`Error deleting image ${imageId}:`, error);
      }
    }

    // Show results
    if (failedCount === 0) {
      alert(`Successfully deleted ${deletedCount} image${deletedCount > 1 ? 's' : ''}!`);
    } else {
      alert(`Deleted ${deletedCount} image${deletedCount > 1 ? 's' : ''}, but failed to delete ${failedCount} image${deletedCount > 1 ? 's' : ''}.`);
    }

    // Reload data and refresh UI
    await loadImages();
    await loadAnnotations();
    await loadSessions();
    renderImages();
    updateStats();
    
    // Close modal if it was open
    closeImageModal();
    
  } catch (error) {
    console.error('Error during bulk delete:', error);
    alert('An error occurred during bulk delete. Please try again.');
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



// Upload images through management interface
async function uploadImagesToManagement(files) {
  const formData = new FormData();
  
  for (const file of files) {
    formData.append('images', file);
  }
  
  try {
    const response = await fetch('/api/management/upload-images', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      alert(result.message);
      
      // Reload data and refresh UI
      await loadImages();
      await loadAnnotations();
      await loadSessions();
      renderImages();
      updateStats();
    } else {
      const errorText = await response.text();
      alert('Upload failed: ' + errorText);
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert('Upload failed. Please try again.');
  }
}

// Rotate image
async function rotateImage(imageId) {
  try {
    const response = await fetch(`/api/image/${imageId}/rotate`, {
      method: 'POST'
    });

    if (response.ok) {
      const result = await response.json();
      //alert('Image rotated successfully!');
      
      // Reload images and annotations to get updated data
      await loadImages();
      await loadAnnotations();
      renderImages();
      updateStats();
      
      // Refresh the modal if it's open with fresh cache-busting
      if (currentImage) {
        const modalImage = document.getElementById('modalImage');
        const cacheBuster = Date.now() + Math.random();
        modalImage.src = `${currentImage.url.split('?')[0]}?t=${cacheBuster}`;
        
        const imageAnnotations = annotations[currentImage.filename] || [];
        renderAnnotationsList(imageAnnotations);
      }
    } else {
      const errorText = await response.text();
      alert('Failed to rotate image: ' + errorText);
    }
  } catch (error) {
    console.error('Error rotating image:', error);
    alert('Failed to rotate image. Please try again.');
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Initialize data
  loadImages();
  loadAnnotations();
  loadSessions();
  loadTags();
  
  // Sort and filter controls
  document.getElementById('sortSelect').addEventListener('change', renderImages);
  document.getElementById('filterSelect').addEventListener('change', renderImages);
  document.getElementById('searchInput').addEventListener('input', renderImages);
  document.getElementById('readyFilterSelect').addEventListener('change', renderImages);
  document.getElementById('sessionFilterSelect').addEventListener('change', renderImages);
  
  // Upload button (now in header nav)
  document.getElementById('uploadImagesBtn').addEventListener('click', () => {
    document.getElementById('managementImageInput').click();
  });
  
  document.getElementById('managementImageInput').addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
      uploadImagesToManagement(event.target.files);
      event.target.value = ''; // Reset input
    }
  });
  
  // Tag management
  document.getElementById('createTagBtn').addEventListener('click', createTag);
  
  // Tag assignment
  document.getElementById('assignTagBtn').addEventListener('click', assignTagToSelectedImages);
  document.getElementById('addTagToImageBtn').addEventListener('click', () => {
    if (currentImage) {
      addTagToImage(currentImage.id);
    }
  });
  
  // Filter controls
  document.getElementById('favoriteFilterSelect').addEventListener('change', renderImages);
  document.getElementById('tagFilterSelect').addEventListener('change', renderImages);
  
  // Bulk selection buttons
  document.getElementById('selectAllBtn').addEventListener('click', selectAllImages);
  document.getElementById('deselectAllBtn').addEventListener('click', deselectAllImages);
  document.getElementById('setReadyBtn').addEventListener('click', () => updateSelectedImagesReady(true));
  document.getElementById('setNotReadyBtn').addEventListener('click', () => updateSelectedImagesReady(false));
  document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedImages);
  

  
  // Modal close buttons
  document.getElementById('closeModal').addEventListener('click', closeImageModal);
  document.getElementById('closeRecordingModal').addEventListener('click', closeRecordingModal);
  
  // Image modal buttons
  document.getElementById('addAnnotation').addEventListener('click', openRecordingModal);
  document.getElementById('deleteImage').addEventListener('click', () => {
    if (currentImage) {
      deleteImage(currentImage.id);
    }
  });
  
  // Rotation functionality
  document.getElementById('rotateImage').addEventListener('click', async () => {
    if (currentImage) {
      await rotateImage(currentImage.id);
    }
  });
  
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
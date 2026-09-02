const grid = document.querySelector('#heritage-grid');
const archiveStatus = document.querySelector('#archive-status');
const emptyState = document.querySelector('#empty-state');
const search = document.querySelector('#hero-query');
const detailModal = document.querySelector('#detail-modal');
const arModal = document.querySelector('#ar-modal');
const cameraFeed = document.querySelector('#camera-feed');
const cameraFrame = document.querySelector('#camera-frame');
const cameraNote = document.querySelector('#camera-note');
const storyPicker = document.querySelector('#ar-story-picker');
const placedStory = document.querySelector('#placed-story');
let activeCategory = '';
let activeQuery = '';
let cameraStream;
let stories = [];
let activeArStory;
let placing = false;
let activeUtterance;

const escape = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);

function cardMarkup(entry, index) {
  return `<button class="heritage-card" data-slug="${escape(entry.slug)}" style="animation-delay:${Math.min(index * 45, 320)}ms">
    <div class="card-image" style="--image:url('${escape(entry.image)}')"><span class="card-number">${String(index + 1).padStart(2, '0')}</span><span class="card-category">${escape(entry.category)}</span></div>
    <div class="card-info"><h3>${escape(entry.name)}</h3><p>${escape(entry.summary)}</p><span class="card-arrow">↗</span></div>
  </button>`;
}

function refreshArStory() {
  if (!activeArStory) return;
  document.querySelector('#ar-story-title').textContent = activeArStory.name;
  document.querySelector('#place-story-label').textContent = activeArStory.name;
  document.querySelector('#ar-story-intro').textContent = `Open your camera, then tap the viewfinder to place ${activeArStory.name} with its period and context.`;
  storyPicker.value = activeArStory.slug;
}

function selectArStory(entry) {
  if (!entry) return;
  activeArStory = entry;
  placing = false;
  cameraFrame.classList.remove('placing');
  placedStory.hidden = true;
  refreshArStory();
}

async function loadAllStories() {
  const response = await fetch('/api/heritage');
  const payload = await response.json();
  stories = payload.results;
  storyPicker.innerHTML = stories.map((story) => `<option value="${escape(story.slug)}">${escape(story.name)} · ${escape(story.district)}</option>`).join('');
  if (!activeArStory) selectArStory(stories.find((story) => story.slug === 'raigad-fort') || stories[0]);
  else refreshArStory();
}

async function loadHeritage({ category = activeCategory, query = activeQuery } = {}) {
  activeCategory = category;
  activeQuery = query;
  archiveStatus.textContent = 'Finding stories in Maharashtra…';
  grid.setAttribute('aria-busy', 'true');
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (query) params.set('q', query);
  try {
    const response = await fetch(`/api/heritage?${params}`);
    if (!response.ok) throw new Error('Repository unavailable');
    const payload = await response.json();
    grid.innerHTML = payload.results.map(cardMarkup).join('');
    emptyState.hidden = payload.results.length > 0;
    grid.hidden = payload.results.length === 0;
    const state = category || (query ? `Search: “${query}”` : 'All stories');
    archiveStatus.textContent = `${payload.total} ${payload.total === 1 ? 'story' : 'stories'} · ${state} · Maharashtra only`;
  } catch {
    grid.innerHTML = '';
    grid.hidden = true;
    emptyState.hidden = false;
    archiveStatus.textContent = 'The repository could not be reached. Please try again.';
  } finally { grid.removeAttribute('aria-busy'); }
}

async function showDetail(slug) {
  try {
    const response = await fetch(`/api/heritage/${encodeURIComponent(slug)}`);
    if (!response.ok) throw new Error('Not found');
    const entry = await response.json();
    if (!stories.some((story) => story.slug === entry.slug)) stories.push(entry);
    selectArStory(entry);
    document.querySelector('#detail-image').style.setProperty('--image', `url("${entry.image}")`);
    document.querySelector('#detail-kind').textContent = `${entry.category} · ${entry.kind}`;
    document.querySelector('#detail-name').textContent = entry.name;
    document.querySelector('#detail-meta').textContent = `${entry.district} · ${entry.period}`;
    document.querySelector('#detail-story').textContent = entry.story;
    document.querySelector('#detail-tags').innerHTML = entry.tags.map((tag) => `<span>${escape(tag)}</span>`).join('');
    if (!detailModal.open) detailModal.showModal();
  } catch { archiveStatus.textContent = 'We could not open that story. Please try another entry.'; }
}

function openAR() {
  if (detailModal.open) detailModal.close();
  if (!arModal.open) arModal.showModal();
}

function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  cameraFeed.srcObject = null;
  cameraFrame.classList.remove('active', 'placing');
  placing = false;
  document.querySelector('#start-camera').innerHTML = '<span class="button-icon">◉</span> Open camera';
}

function placeAt(event) {
  if (!placing || !activeArStory || event.target.closest('#remove-story')) return;
  const bounds = cameraFrame.getBoundingClientRect();
  const x = Math.max(16, Math.min(84, ((event.clientX - bounds.left) / bounds.width) * 100));
  const y = Math.max(18, Math.min(82, ((event.clientY - bounds.top) / bounds.height) * 100));
  document.querySelector('#placed-story-image').src = activeArStory.image;
  document.querySelector('#placed-story-image').alt = activeArStory.name;
  document.querySelector('#placed-story-name').textContent = activeArStory.name;
  document.querySelector('#placed-story-meta').textContent = `${activeArStory.district} · ${activeArStory.period}`;
  placedStory.style.setProperty('--x', `${x}%`);
  placedStory.style.setProperty('--y', `${y}%`);
  placedStory.hidden = false;
  placing = false;
  cameraFrame.classList.remove('placing');
  cameraNote.textContent = `${activeArStory.name} placed. Use “Tap to place” again to move it.`;
}

document.querySelector('#hero-search').addEventListener('submit', (event) => {
  event.preventDefault(); activeQuery = search.value.trim(); activeCategory = '';
  document.querySelectorAll('.filter').forEach((button) => button.classList.toggle('active', !button.dataset.category));
  document.querySelector('#explore').scrollIntoView({ behavior: 'smooth', block: 'start' }); loadHeritage();
});
document.querySelector('#focus-search').addEventListener('click', () => { search.focus(); search.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
  activeCategory = button.dataset.category; activeQuery = ''; search.value = '';
  document.querySelectorAll('.filter').forEach((filter) => filter.classList.toggle('active', filter.dataset.category === activeCategory));
  document.querySelector('#explore').scrollIntoView({ behavior: 'smooth', block: 'start' }); loadHeritage();
}));
grid.addEventListener('click', (event) => { const card = event.target.closest('[data-slug]'); if (card) showDetail(card.dataset.slug); });
document.querySelectorAll('[data-slug]').forEach((button) => button.addEventListener('click', () => showDetail(button.dataset.slug)));
document.querySelector('#clear-search').addEventListener('click', () => { activeCategory = ''; activeQuery = ''; search.value = ''; loadHeritage(); });
document.querySelectorAll('[data-open-ar]').forEach((button) => button.addEventListener('click', openAR));
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => detailModal.close()));
document.querySelectorAll('[data-close-ar]').forEach((button) => button.addEventListener('click', () => arModal.close()));
arModal.addEventListener('close', stopCamera);

storyPicker.addEventListener('change', () => {
  selectArStory(stories.find((story) => story.slug === storyPicker.value));
  cameraNote.textContent = `${activeArStory.name} selected. Open the camera, then tap to place it.`;
});
document.querySelector('#start-camera').addEventListener('click', async () => {
  if (cameraStream) {
    cameraNote.classList.remove('error');
    cameraNote.textContent = `Camera is live. Tap “Tap to place”, then choose a spot for ${activeArStory.name}.`;
    return;
  }
  cameraNote.classList.remove('error'); cameraNote.textContent = 'Requesting camera access…';
  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    cameraFeed.srcObject = cameraStream; cameraFrame.classList.add('active');
    document.querySelector('#start-camera').innerHTML = '<span class="button-icon">✓</span> Camera live';
    cameraNote.textContent = `Camera live. Tap “Tap to place”, then tap the viewfinder for ${activeArStory.name}.`;
  } catch { cameraNote.classList.add('error'); cameraNote.textContent = 'Camera access was blocked. Allow camera permission and try again.'; }
});
document.querySelector('#place-story').addEventListener('click', () => {
  if (!cameraStream) { cameraNote.classList.add('error'); cameraNote.textContent = 'Open the camera first, then tap to place the selected story.'; return; }
  placing = true; cameraFrame.classList.add('placing'); cameraNote.classList.remove('error'); cameraNote.textContent = `Tap a spot in the viewfinder to place ${activeArStory.name}.`;
});
cameraFrame.addEventListener('click', placeAt);
document.querySelector('#remove-story').addEventListener('click', (event) => { event.stopPropagation(); placedStory.hidden = true; cameraNote.textContent = 'Story removed. Tap “Tap to place” to place it again.'; });
document.querySelector('#listen-story').addEventListener('click', () => {
  const button = document.querySelector('#listen-story');
  if (!('speechSynthesis' in window)) { button.textContent = 'Audio is not supported in this browser'; return; }
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); button.textContent = '◖ Listen to story'; return; }
  const name = document.querySelector('#detail-name').textContent;
  const meta = document.querySelector('#detail-meta').textContent;
  const story = document.querySelector('#detail-story').textContent;
  activeUtterance = new SpeechSynthesisUtterance(`${name}. ${meta}. ${story}`);
  activeUtterance.lang = 'en-IN'; activeUtterance.rate = 0.9;
  activeUtterance.onend = activeUtterance.onerror = () => { button.textContent = '◖ Listen to story'; };
  button.textContent = '■ Stop audio guide'; speechSynthesis.speak(activeUtterance);
});

loadHeritage();
loadAllStories().catch(() => { cameraNote.textContent = 'Story selector could not load. Refresh and try again.'; });

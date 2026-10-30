'use strict';

const DB_NAME = 'material-vault-db';
const DB_VERSION = 1;
const STORE_NAME = 'materials';
const CORE_MAPS = ['baseColor', 'roughness', 'normal', 'height'];
const MAP_LABELS = { baseColor: 'BASE COLOR', roughness: 'ROUGHNESS', normal: 'NORMAL', height: 'HEIGHT' };

const elements = {
  grid: document.getElementById('materialsGrid'), empty: document.getElementById('emptyState'),
  dialog: document.getElementById('materialDialog'), form: document.getElementById('materialForm'),
  search: document.getElementById('searchInput'), category: document.getElementById('categoryFilter'),
  status: document.getElementById('statusFilter'), toast: document.getElementById('toast'),
  importInput: document.getElementById('importInput')
};

let db;
let materials = [];
let editingId = null;
let selectedQuickFilter = 'all';
let toastTimer;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('This browser does not support local database storage.'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the local database.'));
  });
}

function storeRequest(mode, action, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = action === 'getAll' ? store.getAll() : action === 'delete' ? store.delete(value) : store.put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('The database operation failed.'));
  });
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function hasCompleteMaps(material) {
  return CORE_MAPS.every(map => Boolean(material.maps?.[map]));
}

function getCoreMapCount(material) {
  return CORE_MAPS.filter(map => Boolean(material.maps?.[map])).length;
}

function revokePreviewUrls() {
  document.querySelectorAll('.material-preview img[data-object-url]').forEach(img => URL.revokeObjectURL(img.dataset.objectUrl));
}

function createCard(material) {
  const card = document.createElement('article');
  card.className = 'material-card';
  card.dataset.id = material.id;
  const imageMarkup = material.imageBlob
    ? '<img class="material-image" alt="Preview of ' + escapeHTML(material.name) + '" data-image-id="' + escapeHTML(material.id) + '">'
    : '<div class="preview-placeholder"><span class="placeholder-label">' + escapeHTML(material.category.toUpperCase()) + ' / PBR</span></div>';
  const mapMarkup = CORE_MAPS.map(map => '<span class="map-tag ' + (material.maps?.[map] ? 'present' : '') + '">' + MAP_LABELS[map] + '</span>').join('');
  const tagsText = (material.tags || []).length ? material.tags.join(' · ') : 'No tags added';
  const complete = hasCompleteMaps(material);
  card.innerHTML = `
    <div class="material-preview">
      ${imageMarkup}
      <span class="category-pill">${escapeHTML(material.category)}</span>
      <button class="card-menu" type="button" aria-label="More actions for ${escapeHTML(material.name)}" title="Edit or delete">···</button>
    </div>
    <div class="material-body">
      <div class="material-meta"><span>${escapeHTML(material.resolution || 'Unknown')} TEXTURE</span><span>${escapeHTML(new Date(material.updatedAt || material.createdAt).toLocaleDateString())}</span></div>
      <h3 title="${escapeHTML(material.name)}">${escapeHTML(material.name)}</h3>
      <div class="map-status">${mapMarkup}</div>
      <div class="card-bottom"><span class="tag-list" title="${escapeHTML(tagsText)}">${escapeHTML(tagsText)}</span><span class="status-label ${complete ? '' : 'incomplete'}">${complete ? '● COMPLETE' : getCoreMapCount(material) + '/4 MAPS'}</span></div>
    </div>`;
  card.querySelector('.card-menu').addEventListener('click', event => {
    event.stopPropagation();
    showCardActions(material.id, card);
  });
  return card;
}

async function render() {
  revokePreviewUrls();
  const query = elements.search.value.trim().toLowerCase();
  const category = elements.category.value;
  const status = elements.status.value;
  const filtered = materials.filter(material => {
    const searchable = [material.name, material.category, material.resolution, material.notes, ...(material.tags || [])].join(' ').toLowerCase();
    const matchesQuick = selectedQuickFilter === 'all' || (selectedQuickFilter === 'complete' ? hasCompleteMaps(material) : !hasCompleteMaps(material));
    const matchesStatus = status === 'all' || (status === 'complete' ? hasCompleteMaps(material) : !hasCompleteMaps(material));
    return searchable.includes(query) && (category === 'all' || material.category === category) && matchesStatus && matchesQuick;
  });

  elements.grid.replaceChildren(...filtered.map(createCard));
  elements.empty.classList.toggle('show', filtered.length === 0);
  elements.empty.querySelector('h3').textContent = materials.length === 0 ? 'Your library starts here.' : 'No materials match that search.';
  elements.empty.querySelector('p').textContent = materials.length === 0
    ? 'Add a material, mark the maps you have, and keep your texture collection organized.'
    : 'Try another search or clear your filters to see the rest of your library.';
  document.getElementById('resultCount').textContent = `(${filtered.length})`;
  document.getElementById('navCount').textContent = materials.length;
  updateStats();

  for (const material of filtered) {
    if (!material.imageBlob) continue;
    const image = elements.grid.querySelector(`img[data-image-id="${CSS.escape(material.id)}"]`);
    if (image) {
      const url = URL.createObjectURL(material.imageBlob);
      image.src = url;
      image.dataset.objectUrl = url;
    }
  }
}

function updateStats() {
  const total = materials.length;
  const complete = materials.filter(hasCompleteMaps).length;
  const attention = total - complete;
  const health = total ? Math.round((complete / total) * 100) : 0;
  document.getElementById('totalStat').textContent = total;
  document.getElementById('completeStat').textContent = complete;
  document.getElementById('attentionStat').textContent = attention;
  document.getElementById('healthStat').textContent = total ? `${health}%` : '—';
  document.getElementById('healthBar').style.width = `${health}%`;
}

async function refresh() {
  materials = await storeRequest('readonly', 'getAll');
  materials.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  await render();
}

function resetForm() {
  elements.form.reset();
  document.getElementById('materialResolution').value = '2K';
  document.getElementById('materialImage').value = '';
  editingId = null;
  document.getElementById('dialogTitle').textContent = 'Add a material';
}

function openAddDialog() {
  resetForm();
  elements.dialog.showModal();
  document.getElementById('materialName').focus();
}

function openEditDialog(material) {
  resetForm();
  editingId = material.id;
  document.getElementById('dialogTitle').textContent = 'Edit material';
  document.getElementById('materialName').value = material.name;
  document.getElementById('materialCategory').value = material.category;
  document.getElementById('materialResolution').value = material.resolution || 'Unknown';
  document.getElementById('materialTags').value = (material.tags || []).join(', ');
  document.getElementById('materialNotes').value = material.notes || '';
  CORE_MAPS.forEach(map => { elements.form.elements[map].checked = Boolean(material.maps?.[map]); });
  elements.dialog.showModal();
  document.getElementById('materialName').focus();
}

function showCardActions(id, card) {
  const existingMenu = document.querySelector('.card-action-menu');
  if (existingMenu) {
    const wasThisCard = existingMenu.closest('.material-card') === card;
    existingMenu.remove();
    if (wasThisCard) return;
  }
  const material = materials.find(item => item.id === id);
  if (!material) return;
  const menu = document.createElement('div');
  menu.className = 'card-action-menu';
  menu.innerHTML = '<button type="button" data-action="edit">Edit material</button><button type="button" data-action="delete" class="delete-action">Delete material</button>';
  card.querySelector('.material-preview').appendChild(menu);
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
    menu.remove();
    openEditDialog(material);
  });
  menu.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    menu.remove();
    const confirmed = window.confirm(`Delete "${material.name}" from this browser's library?`);
    if (!confirmed) return;
    try {
      await storeRequest('readwrite', 'delete', id);
      await refresh();
      toast('Material deleted.');
    } catch (error) {
      toast(error.message || 'Could not delete this material.');
    }
  });
  const closeMenu = event => {
    if (!menu.contains(event.target) && !card.querySelector('.card-menu').contains(event.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

async function readImage(file) {
  if (!file) return null;
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) throw new Error('Use a JPG, PNG, or WebP preview image.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Preview image must be 3 MB or smaller.');
  return file;
}

async function saveMaterial(event) {
  event.preventDefault();
  const name = document.getElementById('materialName').value.trim();
  if (!name) return toast('Add a material name first.');
  try {
    const existing = editingId ? materials.find(item => item.id === editingId) : null;
    const imageFile = document.getElementById('materialImage').files[0];
    const imageBlob = imageFile ? await readImage(imageFile) : (existing?.imageBlob || null);
    const now = new Date().toISOString();
    const material = {
      id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `material-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name,
      category: document.getElementById('materialCategory').value,
      resolution: document.getElementById('materialResolution').value,
      tags: document.getElementById('materialTags').value.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12),
      notes: document.getElementById('materialNotes').value.trim(),
      maps: Object.fromEntries(CORE_MAPS.map(map => [map, elements.form.elements[map].checked])),
      imageBlob,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await storeRequest('readwrite', 'put', material);
    elements.dialog.close();
    resetForm();
    await refresh();
    toast(existing ? 'Material updated.' : 'Material added to your library.');
  } catch (error) {
    toast(error.message || 'Could not save this material.');
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportLibrary() {
  const data = {
    app: 'Material Vault', version: 1, exportedAt: new Date().toISOString(),
    note: 'Export includes material metadata and map flags. Preview image files are not included.',
    materials: materials.map(({ id, name, category, resolution, tags, notes, maps, createdAt, updatedAt }) => ({ id, name, category, resolution, tags, notes, maps, createdAt, updatedAt }))
  };
  downloadFile('material-vault-library.json', JSON.stringify(data, null, 2), 'application/json');
  toast('Library metadata exported.');
}

async function importLibrary(file) {
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('Import file is too large.');
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.materials)) throw new Error('This file is not a Material Vault library export.');
    let imported = 0;
    for (const raw of parsed.materials) {
      if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) continue;
      const material = {
        id: crypto.randomUUID ? crypto.randomUUID() : `import-${Date.now()}-${imported}`,
        name: raw.name.slice(0, 70),
        category: ['Wood', 'Stone', 'Fabric', 'Tile', 'Metal', 'Concrete', 'Other'].includes(raw.category) ? raw.category : 'Other',
        resolution: ['1K', '2K', '4K', '8K', '16K', 'Unknown'].includes(raw.resolution) ? raw.resolution : 'Unknown',
        tags: Array.isArray(raw.tags) ? raw.tags.filter(tag => typeof tag === 'string').slice(0, 12) : [],
        notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 500) : '',
        maps: Object.fromEntries(CORE_MAPS.map(map => [map, Boolean(raw.maps?.[map])])),
        imageBlob: null,
        createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await storeRequest('readwrite', 'put', material);
      imported++;
    }
    await refresh();
    toast(`${imported} material${imported === 1 ? '' : 's'} imported.`);
  } catch (error) {
    toast(error.message || 'Could not import this file.');
  } finally {
    elements.importInput.value = '';
  }
}

function wireEvents() {
  document.getElementById('addBtn').addEventListener('click', openAddDialog);
  document.getElementById('emptyAddBtn').addEventListener('click', openAddDialog);
  document.getElementById('closeDialog').addEventListener('click', () => elements.dialog.close());
  document.getElementById('cancelDialog').addEventListener('click', () => elements.dialog.close());
  elements.form.addEventListener('submit', saveMaterial);
  elements.search.addEventListener('input', render);
  elements.category.addEventListener('change', render);
  elements.status.addEventListener('change', render);
  document.getElementById('exportBtn').addEventListener('click', exportLibrary);
  document.getElementById('importBtn').addEventListener('click', () => elements.importInput.click());
  elements.importInput.addEventListener('change', event => importLibrary(event.target.files[0]));
  document.querySelectorAll('.filter-chip').forEach(button => button.addEventListener('click', () => {
    selectedQuickFilter = button.dataset.filter;
    document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.toggle('selected', chip === button));
    render();
  }));
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !elements.dialog.open) {
      event.preventDefault(); elements.search.focus();
    }
    if (event.key === 'Escape' && elements.dialog.open) elements.dialog.close();
  });
}

async function init() {
  wireEvents();
  try {
    db = await openDatabase();
    await refresh();
  } catch (error) {
    toast(error.message || 'Local storage is unavailable in this browser.');
    elements.empty.classList.add('show');
  }
}

init();

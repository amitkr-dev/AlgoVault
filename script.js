// ==========================================
// STATE MANAGEMENT & PERSISTENCE
// ==========================================

const STORAGE_KEY = 'dsa_knowledge_base_v1';
const THEME_KEY = 'dsa_theme';

let state = {
    topics: [],
    activePatternId: null,
    darkMode: false,
    filters: {
        favorites: false,
        revision: false
    }
};

let saveTimeout = null;

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
    } else {
        // Seed with initial data
        state.topics = [
            {
                id: generateId(),
                name: 'Arrays',
                expanded: true,
                patterns: [
                    {
                        id: generateId(),
                        name: 'Sliding Window',
                        favorite: true,
                        tags: ['Array', 'Important'],
                        notes: '## Sliding Window\n\nUsed for finding subarrays.\n\nTemplate:\n```python\nl = 0\nfor r in range(len(arr)):\n    # add arr[r]\n    while condition:\n        # remove arr[l]\n        l += 1\n    # update ans\n```',
                        timeComplexity: 'O(n)',
                        spaceComplexity: 'O(k)',
                        codeTemplate: 'def sliding_window(arr, k):\n    l = 0\n    for r in range(len(arr)):\n        pass',
                        mistakesLog: "- LC 3: Forgot to update max when shrinking window.\n- LC 76: Off by one error when moving left pointer.",
                        updatedAt: Date.now(),
                        revisedCount: 3,
                        lastRevised: Date.now() - 86400000
                    }
                ]
            },
            {
                id: generateId(),
                name: 'Graphs',
                expanded: false,
                patterns: [
                    {
                        id: generateId(),
                        name: 'BFS',
                        favorite: false,
                        tags: ['Graph', 'Interview'],
                        notes: 'Breadth First Search template...',
                        timeComplexity: 'O(V+E)',
                        spaceComplexity: 'O(V)',
                        codeTemplate: '',
                        mistakesLog: '',
                        updatedAt: Date.now(),
                        revisedCount: 1,
                        lastRevised: Date.now() - 172800000
                    }
                ]
            }
        ];
        saveState();
    }
    
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === 'dark') {
        state.darkMode = true;
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('darkModeToggle').textContent = '☀️';
    }
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================

function render() {
    renderSidebar();
    renderContent();
}

function renderSidebar() {
    const list = document.getElementById('topicsList');
    list.innerHTML = '';

    let topicsToRender = state.topics;
    
    if (state.filters.favorites || state.filters.revision) {
        topicsToRender = state.topics.map(topic => {
            let patterns = topic.patterns;
            if (state.filters.favorites) patterns = patterns.filter(p => p.favorite);
            if (state.filters.revision) patterns = patterns.filter(p => p.revisedCount === 0);
            return { ...topic, patterns, expanded: patterns.length > 0 ? true : topic.expanded };
        }).filter(t => t.patterns.length > 0);
    }

    topicsToRender.forEach(topic => {
        const topicEl = document.createElement('li');
        topicEl.className = 'topic-item';
        topicEl.draggable = true;
        topicEl.dataset.id = topic.id;

        const header = document.createElement('div');
        header.className = `topic-header ${topic.expanded ? 'expanded' : ''}`;
        header.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <span class="arrow">▶</span>
            <span class="topic-name">${escapeHtml(topic.name)}</span>
            <div class="topic-actions">
                <button class="topic-action-btn add-pattern" title="Add Pattern">+</button>
                <button class="topic-action-btn rename-topic" title="Rename">✎</button>
                <button class="topic-action-btn delete-topic" title="Delete">🗑</button>
            </div>
        `;
        
        header.addEventListener('click', (e) => {
            if (e.target.closest('.topic-action-btn')) return;
            toggleTopicExpand(topic.id);
        });

        header.querySelector('.add-pattern').addEventListener('click', (e) => { e.stopPropagation(); addPattern(topic.id); });
        header.querySelector('.rename-topic').addEventListener('click', (e) => { e.stopPropagation(); renameTopic(topic.id); });
        header.querySelector('.delete-topic').addEventListener('click', (e) => { e.stopPropagation(); deleteTopic(topic.id); });

        const patternsList = document.createElement('ul');
        patternsList.className = `patterns-list ${topic.expanded ? 'expanded' : ''}`;

        topic.patterns.forEach(pattern => {
            const patternEl = document.createElement('li');
            patternEl.className = `pattern-item ${state.activePatternId === pattern.id ? 'active' : ''}`;
            patternEl.draggable = true;
            patternEl.dataset.id = pattern.id;
            patternEl.dataset.topicId = topic.id;
            
            patternEl.innerHTML = `
                ${pattern.favorite ? '<span class="fav-star">★</span>' : ''}
                <span class="pattern-name">${escapeHtml(pattern.name)}</span>
                <div class="pattern-actions">
                    <button class="rename-pattern" title="Rename Pattern">✎</button>
                    <button class="delete-pattern" title="Delete Pattern">🗑</button>
                </div>
            `;
            
            patternEl.addEventListener('click', (e) => {
                if (e.target.closest('.delete-pattern') || e.target.closest('.rename-pattern')) return;
                selectPattern(pattern.id);
            });

            patternEl.querySelector('.rename-pattern').addEventListener('click', (e) => { e.stopPropagation(); renamePattern(pattern.id); });
            patternEl.querySelector('.delete-pattern').addEventListener('click', (e) => { e.stopPropagation(); deletePattern(pattern.id); });

            patternsList.appendChild(patternEl);
        });

        topicEl.appendChild(header);
        topicEl.appendChild(patternsList);
        list.appendChild(topicEl);
    });

    setupDragAndDrop();
}

function renderContent() {
    const dashboardView = document.getElementById('dashboardView');
    const patternView = document.getElementById('patternView');
    const revisionView = document.getElementById('revisionView');
    const emptyState = document.getElementById('emptyState');

    dashboardView.classList.add('hidden');
    patternView.classList.add('hidden');
    revisionView.classList.add('hidden');
    emptyState.classList.add('hidden');

    if (state.activePatternId === 'dashboard') {
        renderDashboard();
        dashboardView.classList.remove('hidden');
    } else if (state.activePatternId) {
        const pattern = findPattern(state.activePatternId);
        if (pattern) {
            if (state.filters.revision) {
                renderRevisionMode(pattern);
                revisionView.classList.remove('hidden');
            } else {
                renderPatternView(pattern);
                patternView.classList.remove('hidden');
            }
        } else {
            emptyState.classList.remove('hidden');
        }
    } else {
        emptyState.classList.remove('hidden');
    }
}

function renderPatternView(pattern) {
    document.getElementById('patternNameInput').value = pattern.name;
    document.getElementById('timeComplexity').value = pattern.timeComplexity || '';
    document.getElementById('spaceComplexity').value = pattern.spaceComplexity || '';
    document.getElementById('codeTemplate').value = pattern.codeTemplate || '';
    document.getElementById('mistakesTextarea').value = pattern.mistakesLog || '';
    
    const favBtn = document.getElementById('favBtn');
    favBtn.textContent = pattern.favorite ? '★' : '☆';
    favBtn.classList.toggle('active', pattern.favorite);

    const tagsList = document.getElementById('tagsList');
    tagsList.innerHTML = '';
    pattern.tags.forEach((tag, idx) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.innerHTML = `${escapeHtml(tag)} <span class="remove-tag" data-idx="${idx}">×</span>`;
        tagEl.querySelector('.remove-tag').addEventListener('click', () => removeTag(pattern.id, idx));
        tagsList.appendChild(tagEl);
    });

    document.getElementById('updatedAt').textContent = `Updated: ${formatDate(pattern.updatedAt)}`;
    document.getElementById('revisedCount').textContent = `Revised: ${pattern.revisedCount}x`;
    document.getElementById('lastRevised').textContent = pattern.lastRevised ? `Last Rev: ${formatDate(pattern.lastRevised)}` : '';

    const editor = document.getElementById('notesEditor');
    if (editor.value !== pattern.notes) editor.value = pattern.notes;
}

function renderRevisionMode(pattern) {
    document.getElementById('revPatternName').textContent = pattern.name;
    document.getElementById('revNotesContent').textContent = pattern.notes;
}

function renderDashboard() {
    const totalTopics = state.topics.length;
    const totalPatterns = state.topics.reduce((acc, t) => acc + t.patterns.length, 0);
    const favPatterns = state.topics.reduce((acc, t) => acc + t.patterns.filter(p => p.favorite).length, 0);
    const revCount = state.topics.reduce((acc, t) => acc + t.patterns.reduce((a, p) => a + p.revisedCount, 0), 0);

    const stats = [
        { label: 'Total Topics', value: totalTopics },
        { label: 'Total Patterns', value: totalPatterns },
        { label: 'Favorite Patterns', value: favPatterns },
        { label: 'Total Revisions', value: revCount }
    ];

    const grid = document.getElementById('statsGrid');
    grid.innerHTML = '';
    stats.forEach(s => {
        const card = document.createElement('div');
        card.className = 'stat-card glass';
        card.innerHTML = `<div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div>`;
        grid.appendChild(card);
    });

    const allPatterns = state.topics.flatMap(t => t.patterns);
    const recent = [...allPatterns].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
    
    const recentList = document.getElementById('recentActivityList');
    recentList.innerHTML = '';
    if(recent.length === 0) {
        recentList.innerHTML = '<div class="recent-item" style="justify-content:center; color:var(--text-secondary)">No recent activity.</div>';
    } else {
        recent.forEach(p => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            item.innerHTML = `<span>${escapeHtml(p.name)}</span><span style="font-size:12px; color:var(--text-secondary)">${formatDate(p.updatedAt)}</span>`;
            item.addEventListener('click', () => selectPattern(p.id));
            recentList.appendChild(item);
        });
    }
}

// ==========================================
// ACTIONS & HANDLERS
// ==========================================

function toggleTopicExpand(topicId) {
    const topic = state.topics.find(t => t.id === topicId);
    if (topic) { topic.expanded = !topic.expanded; saveState(); renderSidebar(); }
}

function selectPattern(patternId) {
    state.activePatternId = patternId;
    state.filters = { favorites: false, revision: false };
    document.getElementById('favFilterBtn').classList.remove('active');
    document.getElementById('revFilterBtn').classList.remove('active');
    document.getElementById('sidebar').classList.remove('open');
    saveState(); render();
}

function selectDashboard() {
    state.activePatternId = 'dashboard';
    state.filters = { favorites: false, revision: false };
    document.getElementById('favFilterBtn').classList.remove('active');
    document.getElementById('revFilterBtn').classList.remove('active');
    document.getElementById('sidebar').classList.remove('open');
    saveState(); render();
}

function addTopic() {
    showPromptModal('Add New Topic', 'Enter topic name:', 'Arrays', (name) => {
        if (name) { state.topics.push({ id: generateId(), name, expanded: true, patterns: [] }); saveState(); renderSidebar(); }
    });
}

function addPattern(topicId) {
    showPromptModal('Add New Pattern', 'Enter pattern name:', 'Two Pointers', (name) => {
        if (name) {
            const topic = state.topics.find(t => t.id === topicId);
            if (topic) {
                topic.expanded = true;
                topic.patterns.push({
                    id: generateId(), name, favorite: false, tags: [], notes: '', timeComplexity: '', spaceComplexity: '', codeTemplate: '', mistakesLog: '',
                    updatedAt: Date.now(), revisedCount: 0, lastRevised: null
                });
                saveState(); renderSidebar();
            }
        }
    });
}

function renameTopic(topicId) {
    const topic = state.topics.find(t => t.id === topicId);
    if (!topic) return;
    showPromptModal('Rename Topic', 'Enter new name:', topic.name, (name) => { if (name) { topic.name = name; saveState(); renderSidebar(); } });
}

function deleteTopic(topicId) {
    if (confirm('Are you sure you want to delete this topic and all its patterns?')) {
        state.topics = state.topics.filter(t => t.id !== topicId);
        if (state.topics.length === 0) state.activePatternId = null;
        saveState(); render();
    }
}

function renamePattern(patternId) {
    const pattern = findPattern(patternId);
    if (!pattern) return;
    showPromptModal('Rename Pattern', 'Enter new name:', pattern.name, (name) => { if (name) { pattern.name = name; pattern.updatedAt = Date.now(); saveState(); render(); } });
}

function deletePattern(patternId) {
    if (confirm('Are you sure you want to delete this pattern?')) {
        state.topics.forEach(topic => { topic.patterns = topic.patterns.filter(p => p.id !== patternId); });
        if (state.activePatternId === patternId) state.activePatternId = null;
        saveState(); render();
    }
}

function findPattern(patternId) {
    for (let topic of state.topics) {
        let pattern = topic.patterns.find(p => p.id === patternId);
        if (pattern) return pattern;
    }
    return null;
}

function toggleFavorite(patternId) { const p = findPattern(patternId); if (p) { p.favorite = !p.favorite; p.updatedAt = Date.now(); saveState(); render(); } }
function addTag(patternId, tag) { const p = findPattern(patternId); if (p && !p.tags.includes(tag)) { p.tags.push(tag); p.updatedAt = Date.now(); saveState(); render(); } }
function removeTag(patternId, index) { const p = findPattern(patternId); if (p) { p.tags.splice(index, 1); p.updatedAt = Date.now(); saveState(); render(); } }
function markAsRevised(patternId) { const p = findPattern(patternId); if (p) { p.revisedCount += 1; p.lastRevised = Date.now(); p.updatedAt = Date.now(); saveState(); render(); } }

// Debounced Auto-Save for Textareas
function handleAutoSave(patternId, field, value, statusElementId = 'saveStatus') {
    const p = findPattern(patternId);
    if (p) {
        p[field] = value; p.updatedAt = Date.now();
        if (statusElementId) document.getElementById(statusElementId).textContent = 'Saving...';
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => { 
            saveState(); 
            if (statusElementId) document.getElementById(statusElementId).textContent = 'Saved ✓';
        }, 1000);
    }
}

function handleNameInput(patternId, value) { const p = findPattern(patternId); if (p) { p.name = value; p.updatedAt = Date.now(); saveState(); renderSidebar(); } }
function handleComplexityInput(patternId, field, value) { const p = findPattern(patternId); if (p) { p[field] = value; p.updatedAt = Date.now(); saveState(); } }

// Filters
function toggleFavoriteFilter() {
    state.filters.favorites = !state.filters.favorites; state.filters.revision = false;
    document.getElementById('favFilterBtn').classList.toggle('active', state.filters.favorites);
    document.getElementById('revFilterBtn').classList.remove('active'); renderSidebar();
}
function toggleRevisionFilter() {
    state.filters.revision = !state.filters.revision; state.filters.favorites = false;
    document.getElementById('revFilterBtn').classList.toggle('active', state.filters.revision);
    document.getElementById('favFilterBtn').classList.remove('active');
    if (state.filters.revision && state.activePatternId && state.activePatternId !== 'dashboard') renderContent();
    else if (state.filters.revision && (!state.activePatternId || state.activePatternId === 'dashboard')) alert('Select a pattern from the list to enter Revision Mode.');
    else renderContent();
    renderSidebar();
}

// Theme
function toggleDarkMode() {
    state.darkMode = !state.darkMode;
    if (state.darkMode) { document.documentElement.setAttribute('data-theme', 'dark'); localStorage.setItem(THEME_KEY, 'dark'); document.getElementById('darkModeToggle').textContent = '☀️'; }
    else { document.documentElement.removeAttribute('data-theme'); localStorage.setItem(THEME_KEY, 'light'); document.getElementById('darkModeToggle').textContent = '🌙'; }
}

// Search
function handleSearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    if (!query) { resultsContainer.classList.add('hidden'); return; }

    const results = [];
    const q = query.toLowerCase();

    state.topics.forEach(topic => {
        if (topic.name.toLowerCase().includes(q)) results.push({ type: 'topic', id: topic.id, title: topic.name, snippet: 'Topic', topicName: topic.name });
        topic.patterns.forEach(pattern => {
            if (pattern.name.toLowerCase().includes(q)) results.push({ type: 'pattern', id: pattern.id, title: pattern.name, snippet: 'Pattern', topicName: topic.name });
            if (pattern.notes.toLowerCase().includes(q)) {
                const idx = pattern.notes.toLowerCase().indexOf(q);
                const start = Math.max(0, idx - 20); const end = Math.min(pattern.notes.length, idx + 40);
                let snippet = (start > 0 ? '...' : '') + pattern.notes.substring(start, end) + (end < pattern.notes.length ? '...' : '');
                results.push({ type: 'pattern', id: pattern.id, title: pattern.name, snippet: escapeHtml(snippet), topicName: topic.name });
            }
        });
    });

    if (results.length === 0) resultsContainer.innerHTML = '<div class="search-result-item">No results found</div>';
    else {
        resultsContainer.innerHTML = results.slice(0, 10).map(r => `
            <div class="search-result-item" data-id="${r.id}">
                <div class="res-topic">${escapeHtml(r.topicName)}</div>
                <div class="res-title">${highlightMatch(r.title, query)}</div>
                <div class="res-snippet">${r.snippet ? highlightMatch(r.snippet, query) : ''}</div>
            </div>
        `).join('');
        resultsContainer.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', () => { selectPattern(el.dataset.id); document.getElementById('globalSearch').value = ''; resultsContainer.classList.add('hidden'); });
        });
    }
    resultsContainer.classList.remove('hidden');
}

// Export
function exportPattern(patternId) {
    const p = findPattern(patternId);
    if (!p) return;
    const content = `# ${p.name}\n\nTime: ${p.timeComplexity || 'N/A'}\nSpace: ${p.spaceComplexity || 'N/A'}\nTags: ${p.tags.join(', ')}\nFavorite: ${p.favorite ? 'Yes' : 'No'}\nRevision Count: ${p.revisedCount}\nLast Revised: ${p.lastRevised ? new Date(p.lastRevised).toLocaleString() : 'N/A'}\n\n## Notes\n${p.notes}\n\n## Code Template\n${p.codeTemplate || 'N/A'}\n\n## Mistakes Log\n${p.mistakesLog || 'N/A'}`;
    downloadFile(`${p.name.replace(/\s+/g, '_')}.txt`, content);
}

function exportAll() {
    let content = '# DSA Knowledge Base Export\n\n';
    state.topics.forEach(topic => {
        content += `# TOPIC: ${topic.name}\n\n`;
        topic.patterns.forEach(p => {
            content += `## PATTERN: ${p.name}\n`; content += `Tags: ${p.tags.join(', ')}\n`; content += `Revised: ${p.revisedCount}x\n\n`;
            content += `### Notes:\n${p.notes}\n\n### Code Template:\n${p.codeTemplate || 'N/A'}\n\n### Mistakes Log:\n${p.mistakesLog || 'N/A'}\n\n---\n\n`;
        });
    });
    downloadFile('dsa_notes_export.txt', content);
}

function downloadFile(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob); elem.download = filename;
    document.body.appendChild(elem); elem.click(); document.body.removeChild(elem);
}

// Drag and Drop
let draggedItem = null;
function setupDragAndDrop() {
    document.querySelectorAll('.topic-item, .pattern-item').forEach(el => {
        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragover', handleDragOver);
        el.addEventListener('drop', handleDrop);
        el.addEventListener('dragend', handleDragEnd);
    });
}
function handleDragStart(e) { draggedItem = e.target; e.target.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
function handleDragOver(e) { e.preventDefault(); if (e.target.closest('.topic-item') || e.target.closest('.pattern-item')) e.currentTarget.classList.add('drag-over'); }
function handleDrop(e) {
    e.preventDefault(); e.stopPropagation();
    const target = e.currentTarget; target.classList.remove('drag-over');
    if (draggedItem === target) return;
    const draggedId = draggedItem.dataset.id; const targetId = target.dataset.id;

    if (draggedItem.classList.contains('topic-item') && target.classList.contains('topic-item')) {
        const draggedIdx = state.topics.findIndex(t => t.id === draggedId); const targetIdx = state.topics.findIndex(t => t.id === targetId);
        const [removed] = state.topics.splice(draggedIdx, 1); state.topics.splice(targetIdx, 0, removed);
    } else if (draggedItem.classList.contains('pattern-item')) {
        const draggedPattern = findPattern(draggedId); if (!draggedPattern) return;
        state.topics.forEach(t => { t.patterns = t.patterns.filter(p => p.id !== draggedId); });
        if (target.classList.contains('pattern-item')) {
            const targetTopic = state.topics.find(t => t.id === target.dataset.topicId);
            const targetIdx = targetTopic.patterns.findIndex(p => p.id === targetId);
            targetTopic.patterns.splice(targetIdx, 0, draggedPattern);
        } else if (target.classList.contains('topic-item')) {
            const targetTopic = state.topics.find(t => t.id === targetId);
            targetTopic.expanded = true; targetTopic.patterns.push(draggedPattern);
        }
    }
    saveState(); renderSidebar();
}
function handleDragEnd(e) { e.target.classList.remove('dragging'); document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); }

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; });
}
function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
}
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const diff = Date.now() - timestamp; const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today'; if (days === 1) return 'Yesterday'; if (days < 7) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString();
}

function showPromptModal(title, label, placeholder, callback) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
        <div class="modal">
            <h3>${title}</h3>
            <input type="text" id="modalInput" placeholder="${placeholder}" />
            <div class="modal-actions">
                <button class="btn btn-ghost" id="modalCancel">Cancel</button>
                <button class="btn btn-primary" id="modalOk">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
    const input = document.getElementById('modalInput'); input.focus();
    document.getElementById('modalOk').addEventListener('click', () => { callback(input.value); backdrop.remove(); });
    document.getElementById('modalCancel').addEventListener('click', () => backdrop.remove());
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') { callback(input.value); backdrop.remove(); } });
}

// ==========================================
// EVENT LISTENERS INIT
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadState(); render();

    document.getElementById('sidebarToggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    document.getElementById('addTopicBtn').addEventListener('click', addTopic);
    document.getElementById('addPatternBtn').addEventListener('click', () => { if (state.topics.length === 0) addTopic(); else addPattern(state.topics[0].id); });
    document.getElementById('favFilterBtn').addEventListener('click', toggleFavoriteFilter);
    document.getElementById('revFilterBtn').addEventListener('click', toggleRevisionFilter);
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    const searchInput = document.getElementById('globalSearch');
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrapper')) document.getElementById('searchResults').classList.add('hidden'); });

    document.querySelector('.nav-item[data-action="dashboard"]').addEventListener('click', selectDashboard);

    // Pattern View handlers
    document.getElementById('patternNameInput').addEventListener('input', (e) => { if (state.activePatternId) handleNameInput(state.activePatternId, e.target.value); });
    document.getElementById('timeComplexity').addEventListener('input', (e) => { if (state.activePatternId) handleComplexityInput(state.activePatternId, 'timeComplexity', e.target.value); });
    document.getElementById('spaceComplexity').addEventListener('input', (e) => { if (state.activePatternId) handleComplexityInput(state.activePatternId, 'spaceComplexity', e.target.value); });
    
    // Auto-saving textareas
    document.getElementById('notesEditor').addEventListener('input', (e) => { if (state.activePatternId) handleAutoSave(state.activePatternId, 'notes', e.target.value, 'saveStatus'); });
    document.getElementById('codeTemplate').addEventListener('input', (e) => { if (state.activePatternId) handleAutoSave(state.activePatternId, 'codeTemplate', e.target.value, 'saveStatus'); });
    document.getElementById('mistakesTextarea').addEventListener('input', (e) => { if (state.activePatternId) handleAutoSave(state.activePatternId, 'mistakesLog', e.target.value, 'saveStatus'); });
    
    document.getElementById('favBtn').addEventListener('click', () => { if (state.activePatternId) toggleFavorite(state.activePatternId); });
    document.getElementById('tagInput').addEventListener('keypress', (e) => { if (e.key === 'Enter' && e.target.value.trim()) { addTag(state.activePatternId, e.target.value.trim()); e.target.value = ''; } });
    document.getElementById('reviseBtn').addEventListener('click', () => { if (state.activePatternId) markAsRevised(state.activePatternId); });
    document.getElementById('exportPatternBtn').addEventListener('click', () => { if (state.activePatternId) exportPattern(state.activePatternId); });
    document.getElementById('exitRevModeBtn').addEventListener('click', toggleRevisionFilter);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportAll(); }
    });
});
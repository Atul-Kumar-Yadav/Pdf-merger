// ==================== State Management ====================
const state = {
    pdfs: [], // Array of PDF objects: {id, file, pdfDoc, selectedPages, totalPages}
    nextId: 1
};

// ==================== DOM Elements ====================
const elements = {
    pdfSection: document.getElementById('pdf-section'),
    addPdfBtn: document.getElementById('add-pdf-btn'),
    mergeSection: document.getElementById('merge-section'),
    mergeBtn: document.getElementById('merge-btn'),
    mergeText: document.getElementById('merge-text'),
    progressContainer: document.getElementById('progress-container'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text')
};

// ==================== Initialization ====================
function init() {
    // Start with 2 empty PDF slots
    addPDFSlot();
    addPDFSlot();

    // Setup event listeners
    elements.addPdfBtn.addEventListener('click', addPDFSlot);
    elements.mergeBtn.addEventListener('click', mergePDFs);
}

// ==================== PDF Slot Management ====================
function addPDFSlot() {
    const id = state.nextId++;
    const index = state.pdfs.length;

    // Add to state
    state.pdfs.push({
        id: id,
        file: null,
        pdfDoc: null,
        selectedPages: new Set(),
        totalPages: 0
    });

    // Create card HTML
    const card = createPDFCard(id, index);
    elements.pdfSection.appendChild(card);

    // Setup event listeners for this card
    setupCardListeners(id);

    updateControls();
}

function createPDFCard(id, index) {
    const card = document.createElement('div');
    card.className = 'pdf-card';
    card.id = `pdf-card-${id}`;
    card.innerHTML = `
        <div class="card-header">
            <h2 class="card-title">PDF ${index + 1}</h2>
            <div class="card-controls">
                <button class="btn-reorder btn-move-up" id="move-up-${id}" title="Move Up" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn-reorder btn-move-down" id="move-down-${id}" title="Move Down" ${index === state.pdfs.length - 1 ? 'disabled' : ''}>↓</button>
                <span class="pdf-badge" id="badge-${id}">${index + 1}</span>
            </div>
        </div>
        
        <div class="upload-area" id="upload-area-${id}">
            <input type="file" id="pdf-input-${id}" accept=".pdf" class="file-input">
            <label for="pdf-input-${id}" class="upload-label">
                <div class="upload-icon">📁</div>
                <p class="upload-text">Click or drag PDF here</p>
                <p class="upload-hint">Maximum file size: 50MB</p>
            </label>
        </div>

        <div class="pdf-info" id="pdf-info-${id}" style="display: none;">
            <div class="info-header">
                <span class="file-name" id="file-name-${id}"></span>
                <button class="btn-remove" id="remove-btn-${id}" title="Remove PDF">✕</button>
            </div>
            <div class="page-count" id="page-count-${id}"></div>
        </div>

        <div class="page-selection" id="page-selection-${id}" style="display: none;">
            <div class="selection-controls">
                <input type="text" 
                       id="page-range-${id}" 
                       class="page-range-input" 
                       placeholder="e.g., 1-3, 5, 7-9">
                <div class="quick-actions">
                    <button class="btn-quick" id="select-all-${id}">Select All</button>
                    <button class="btn-quick" id="deselect-all-${id}">Clear</button>
                </div>
            </div>
            <div class="page-thumbnails" id="thumbnails-${id}"></div>
        </div>
    `;

    return card;
}

function setupCardListeners(id) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);

    // File input
    const fileInput = document.getElementById(`pdf-input-${id}`);
    fileInput.addEventListener('change', (e) => handleFileSelect(e, id));

    // Drag and drop
    const uploadArea = document.getElementById(`upload-area-${id}`);
    setupDragAndDrop(uploadArea, id);

    // Remove button
    const removeBtn = document.getElementById(`remove-btn-${id}`);
    removeBtn.addEventListener('click', () => removePDF(id));

    // Page range input
    const pageRangeInput = document.getElementById(`page-range-${id}`);
    pageRangeInput.addEventListener('input', (e) => handlePageRangeInput(e, id));

    // Quick action buttons
    const selectAllBtn = document.getElementById(`select-all-${id}`);
    const deselectAllBtn = document.getElementById(`deselect-all-${id}`);
    selectAllBtn.addEventListener('click', () => selectAllPages(id));
    deselectAllBtn.addEventListener('click', () => deselectAllPages(id));

    // Move buttons
    const moveUpBtn = document.getElementById(`move-up-${id}`);
    const moveDownBtn = document.getElementById(`move-down-${id}`);
    moveUpBtn.addEventListener('click', () => movePDFUp(id));
    moveDownBtn.addEventListener('click', () => movePDFDown(id));
}

// ==================== Drag and Drop ====================
function setupDragAndDrop(uploadArea, id) {
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            handleFile(file, id);
        }
    });
}

// ==================== File Handling ====================
function handleFileSelect(event, id) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file, id);
    }
}

async function handleFile(file, id) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index === -1) return;

    const pdf = state.pdfs[index];

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
        alert('File size exceeds 50MB limit');
        return;
    }

    try {
        // Read PDF
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Update state
        pdf.file = file;
        pdf.pdfDoc = pdfDoc;
        pdf.totalPages = pdfDoc.numPages;
        pdf.selectedPages = new Set();

        // Select all pages by default
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            pdf.selectedPages.add(i);
        }

        // Update UI
        const uploadArea = document.getElementById(`upload-area-${id}`);
        const pdfInfo = document.getElementById(`pdf-info-${id}`);
        const pageSelection = document.getElementById(`page-selection-${id}`);
        const fileName = document.getElementById(`file-name-${id}`);
        const pageCount = document.getElementById(`page-count-${id}`);

        uploadArea.style.display = 'none';
        pdfInfo.style.display = 'block';
        pageSelection.style.display = 'block';

        fileName.textContent = file.name;
        pageCount.textContent = `${pdfDoc.numPages} pages`;

        // Generate thumbnails
        await generateThumbnails(pdfDoc, id);

        // Update page range input
        updatePageRangeInput(id);

        updateControls();

    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF. Please try again.');
    }
}

async function generateThumbnails(pdfDoc, id) {
    const thumbnailsContainer = document.getElementById(`thumbnails-${id}`);
    thumbnailsContainer.innerHTML = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.3 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const thumbnail = document.createElement('div');
        thumbnail.className = 'thumbnail selected';
        thumbnail.dataset.page = pageNum;
        thumbnail.innerHTML = `
            ${canvas.outerHTML}
            <div class="page-number">Page ${pageNum}</div>
        `;

        thumbnail.addEventListener('click', () => togglePageSelection(id, pageNum));
        thumbnailsContainer.appendChild(thumbnail);
    }
}

function togglePageSelection(id, pageNum) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index === -1) return;

    const pdf = state.pdfs[index];
    const thumbnail = document.querySelector(`#thumbnails-${id} .thumbnail[data-page="${pageNum}"]`);

    if (pdf.selectedPages.has(pageNum)) {
        pdf.selectedPages.delete(pageNum);
        thumbnail.classList.remove('selected');
    } else {
        pdf.selectedPages.add(pageNum);
        thumbnail.classList.add('selected');
    }

    updatePageRangeInput(id);
    updateControls();
}

function handlePageRangeInput(event, id) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index === -1) return;

    const pdf = state.pdfs[index];
    const input = event.target.value;
    const pages = parsePageRange(input, pdf.totalPages);

    // Update selected pages
    pdf.selectedPages.clear();
    pages.forEach(page => pdf.selectedPages.add(page));

    // Update thumbnail UI
    const thumbnails = document.querySelectorAll(`#thumbnails-${id} .thumbnail`);
    thumbnails.forEach(thumb => {
        const pageNum = parseInt(thumb.dataset.page);
        if (pdf.selectedPages.has(pageNum)) {
            thumb.classList.add('selected');
        } else {
            thumb.classList.remove('selected');
        }
    });

    updateControls();
}

function parsePageRange(input, totalPages) {
    const pages = new Set();
    const parts = input.split(',');

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        if (trimmed.includes('-')) {
            const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
                    pages.add(i);
                }
            }
        } else {
            const pageNum = parseInt(trimmed);
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                pages.add(pageNum);
            }
        }
    }

    return Array.from(pages).sort((a, b) => a - b);
}

function updatePageRangeInput(id) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index === -1) return;

    const pdf = state.pdfs[index];
    const input = document.getElementById(`page-range-${id}`);

    if (pdf.selectedPages.size === 0) {
        input.value = '';
        return;
    }

    const sorted = Array.from(pdf.selectedPages).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
            end = sorted[i];
        } else {
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            start = sorted[i];
            end = sorted[i];
        }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);

    input.value = ranges.join(', ');
}

function selectAllPages(id) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index === -1) return;

    const pdf = state.pdfs[index];
    pdf.selectedPages.clear();

    for (let i = 1; i <= pdf.totalPages; i++) {
        pdf.selectedPages.add(i);
    }

    const thumbnails = document.querySelectorAll(`#thumbnails-${id} .thumbnail`);
    thumbnails.forEach(thumb => thumb.classList.add('selected'));

    updatePageRangeInput(id);
    updateControls();
}

function deselectAllPages(id) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index === -1) return;

    const pdf = state.pdfs[index];
    pdf.selectedPages.clear();

    const thumbnails = document.querySelectorAll(`#thumbnails-${id} .thumbnail`);
    thumbnails.forEach(thumb => thumb.classList.remove('selected'));

    updatePageRangeInput(id);
    updateControls();
}

function removePDF(id) {
    // Don't allow removing if only 2 PDFs remain
    if (state.pdfs.length <= 2) {
        alert('You must have at least 2 PDFs to merge.');
        return;
    }

    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index === -1) return;

    // Remove from state
    state.pdfs.splice(index, 1);

    // Remove from DOM
    const card = document.getElementById(`pdf-card-${id}`);
    card.remove();

    // Update all card titles and badges
    updateCardLabels();
    updateControls();
}

// ==================== Reorder Functionality ====================
function movePDFUp(id) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index <= 0) return;

    // Swap in state
    [state.pdfs[index], state.pdfs[index - 1]] = [state.pdfs[index - 1], state.pdfs[index]];

    // Swap in DOM
    const card = document.getElementById(`pdf-card-${id}`);
    const prevCard = card.previousElementSibling;
    elements.pdfSection.insertBefore(card, prevCard);

    updateCardLabels();
    updateControls();
}

function movePDFDown(id) {
    const index = state.pdfs.findIndex(pdf => pdf.id === id);
    if (index === -1 || index >= state.pdfs.length - 1) return;

    // Swap in state
    [state.pdfs[index], state.pdfs[index + 1]] = [state.pdfs[index + 1], state.pdfs[index]];

    // Swap in DOM
    const card = document.getElementById(`pdf-card-${id}`);
    const nextCard = card.nextElementSibling;
    elements.pdfSection.insertBefore(nextCard, card);

    updateCardLabels();
    updateControls();
}

function updateCardLabels() {
    state.pdfs.forEach((pdf, index) => {
        const cardTitle = document.querySelector(`#pdf-card-${pdf.id} .card-title`);
        const badge = document.getElementById(`badge-${pdf.id}`);
        const moveUpBtn = document.getElementById(`move-up-${pdf.id}`);
        const moveDownBtn = document.getElementById(`move-down-${pdf.id}`);

        if (cardTitle) cardTitle.textContent = `PDF ${index + 1}`;
        if (badge) badge.textContent = index + 1;

        // Update button states
        if (moveUpBtn) moveUpBtn.disabled = (index === 0);
        if (moveDownBtn) moveDownBtn.disabled = (index === state.pdfs.length - 1);
    });
}

// ==================== Merge Functionality ====================
async function mergePDFs() {
    try {
        // Show progress
        elements.mergeSection.style.display = 'none';
        elements.progressContainer.style.display = 'block';
        updateProgress(0, 'Initializing...');

        // Create new PDF document
        const mergedPdf = await PDFLib.PDFDocument.create();

        const totalPDFs = state.pdfs.filter(pdf => pdf.file).length;

        // Process each PDF
        for (let i = 0; i < state.pdfs.length; i++) {
            const pdf = state.pdfs[i];
            if (!pdf.file) continue;

            const progress = Math.round((i / totalPDFs) * 80);
            updateProgress(progress, `Processing PDF ${i + 1} of ${totalPDFs}...`);

            const pdfBytes = await pdf.file.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

            const selectedPages = Array.from(pdf.selectedPages).sort((a, b) => a - b);

            for (const pageNum of selectedPages) {
                const [copiedPage] = await mergedPdf.copyPages(pdfDoc, [pageNum - 1]);
                mergedPdf.addPage(copiedPage);
            }
        }

        // Save merged PDF
        updateProgress(90, 'Generating merged PDF...');
        const mergedPdfBytes = await mergedPdf.save();

        // Download
        updateProgress(100, 'Complete!');
        downloadPDF(mergedPdfBytes, 'merged.pdf');

        // Reset UI after short delay
        setTimeout(() => {
            elements.progressContainer.style.display = 'none';
            elements.mergeSection.style.display = 'block';
            updateProgress(0, 'Processing...');
        }, 1500);

    } catch (error) {
        console.error('Error merging PDFs:', error);
        alert('Error merging PDFs. Please try again.');
        elements.progressContainer.style.display = 'none';
        elements.mergeSection.style.display = 'block';
    }
}

function downloadPDF(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function updateProgress(percent, text) {
    elements.progressFill.style.width = `${percent}%`;
    elements.progressText.textContent = text;
}

// ==================== UI Updates ====================
function updateControls() {
    // Count PDFs with files
    const loadedPDFs = state.pdfs.filter(pdf => pdf.file).length;

    // Count total selected pages
    let totalSelectedPages = 0;
    state.pdfs.forEach(pdf => {
        totalSelectedPages += pdf.selectedPages.size;
    });

    // Show merge button if at least 2 PDFs loaded with selected pages
    if (loadedPDFs >= 2 && totalSelectedPages > 0) {
        elements.mergeSection.style.display = 'block';
        elements.mergeText.textContent = `Ready to merge ${totalSelectedPages} pages from ${loadedPDFs} PDFs`;
    } else {
        elements.mergeSection.style.display = 'none';
    }
}

// ==================== Initialize App ====================
document.addEventListener('DOMContentLoaded', init);

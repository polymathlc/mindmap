// Mindmap Application
// Main application logic for the mindmap canvas

class MindmapApp {
    constructor() {
        this.canvas = document.getElementById('mindmapCanvas');
        this.ctx = this.canvas.getContext('2d');

        // State
        this.elements = [];
        this.connections = []; // Store connections between shapes
        this.selectedElements = [];
        this.currentTool = 'select';
        this.isDrawing = false;
        this.isDragging = false;
        this.isResizing = false;
        this.isPanning = false;
        this.isConnecting = false;
        this.drawStart = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.resizeHandle = null;
        this.connectionStart = null;

        // Arrow connection mode (press A, click origin, click target)
        this.isArrowConnectionMode = false;
        this.arrowConnectionOrigin = null;

        // Pan and Zoom
        this.panOffset = { x: 0, y: 0 };
        this.zoom = 1;

        // Pastel colors palette
        this.pastelColors = [
            '#FFB3BA', // Pastel Pink
            '#FFDFBA', // Pastel Orange
            '#FFFFBA', // Pastel Yellow
            '#BAFFC9', // Pastel Green
            '#BAE1FF', // Pastel Blue
            '#E0BBE4', // Pastel Purple
            '#D4F0F0', // Pastel Cyan
            '#FCE4EC', // Light Pink
            '#E8F5E9', // Light Green
            '#FFF3E0', // Light Orange
        ];

        // Default drawing settings - pastel colors
        this.fillColor = '#BAE1FF';
        this.strokeColor = '#5DADE2';
        this.strokeWidth = 2;
        this.fontSize = 14;

        // Default shape sizes
        this.defaultWidth = 120;
        this.defaultHeight = 80;

        // Clipboard
        this.clipboard = [];

        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;

        // Temp drawing element
        this.tempElement = null;

        // Initialize
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupToolbar();
        this.setupPropertyPanel();
        this.setupModals();
        this.setupAuth();
        this.saveState();
        this.render();
    }

    // Get a random pastel color
    getRandomPastelColor() {
        return this.pastelColors[Math.floor(Math.random() * this.pastelColors.length)];
    }

    // Get stroke color for a fill color (darker version)
    getStrokeForFill(fillColor) {
        // Convert hex to RGB, darken, and convert back
        const hex = fillColor.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 40);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 40);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 40);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    // Event Listeners
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Paste event for images
        document.addEventListener('paste', (e) => this.handlePaste(e));

        // Prevent default drag behavior
        this.canvas.addEventListener('dragover', (e) => e.preventDefault());
        this.canvas.addEventListener('drop', (e) => this.handleDrop(e));
    }

    // Mouse Handlers
    handleMouseDown(e) {
        const pos = this.getMousePos(e);

        // Middle mouse or space+click for panning
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) return;

        // Handle arrow connection mode clicks
        if (this.isArrowConnectionMode) {
            this.handleArrowConnectionClick(pos);
            return;
        }

        if (this.currentTool === 'select') {
            this.handleSelectMouseDown(pos, e);
        } else if (this.currentTool === 'arrow') {
            this.handleArrowMouseDown(pos, e);
        } else {
            this.handleShapeMouseDown(pos);
        }
    }

    handleSelectMouseDown(pos, e) {
        // Check for resize handles on selected elements
        const handle = this.getResizeHandle(pos);
        if (handle) {
            this.isResizing = true;
            this.resizeHandle = handle;
            return;
        }

        // Check if clicking on a connection point
        const connectionPoint = this.getConnectionPointAtPosition(pos);
        if (connectionPoint) {
            this.isConnecting = true;
            this.connectionStart = connectionPoint;
            return;
        }

        // Check if clicking on an element
        const clickedElement = this.getElementAtPosition(pos);

        if (clickedElement) {
            if (e.ctrlKey || e.metaKey) {
                // Toggle selection
                const idx = this.selectedElements.indexOf(clickedElement);
                if (idx > -1) {
                    this.selectedElements.splice(idx, 1);
                } else {
                    this.selectedElements.push(clickedElement);
                }
            } else if (!this.selectedElements.includes(clickedElement)) {
                this.selectedElements = [clickedElement];
            }

            // Start dragging
            this.isDragging = true;
            this.dragOffset = {
                x: pos.x,
                y: pos.y
            };
            this.dragStartPositions = this.selectedElements.map(el => ({
                element: el,
                x: el.x,
                y: el.y,
                x2: el.x2,
                y2: el.y2
            }));
        } else {
            // Clicked on empty canvas - deselect all
            if (!e.ctrlKey && !e.metaKey) {
                this.selectedElements = [];
            }
            // Start selection box
            this.isDrawing = true;
            this.drawStart = pos;
        }

        this.updatePropertyPanel();
        this.render();
    }

    handleArrowMouseDown(pos, e) {
        // Check if clicking on a shape to start connection
        const clickedElement = this.getElementAtPosition(pos);

        if (clickedElement && clickedElement.type !== 'arrow' && clickedElement.type !== 'line') {
            this.isConnecting = true;
            this.connectionStart = {
                element: clickedElement,
                pos: pos
            };
        } else {
            // Start free-form arrow
            this.isDrawing = true;
            this.drawStart = pos;
            this.tempElement = this.createElement('arrow', pos.x, pos.y, pos.x, pos.y);
        }
    }

    handleShapeMouseDown(pos) {
        // Single click to place a default-sized shape
        const fillColor = this.getRandomPastelColor();
        const strokeColor = this.getStrokeForFill(fillColor);

        const element = this.createElement(
            this.currentTool,
            pos.x - this.defaultWidth / 2,
            pos.y - this.defaultHeight / 2,
            pos.x + this.defaultWidth / 2,
            pos.y + this.defaultHeight / 2
        );

        element.fillColor = fillColor;
        element.strokeColor = strokeColor;

        this.elements.push(element);
        this.selectedElements = [element];
        this.saveState();
        this.render();
        this.updatePropertyPanel();

        // Switch back to select tool after placing
        this.setTool('select');
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.panOffset.x += dx;
            this.panOffset.y += dy;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        if (this.isConnecting && this.connectionStart) {
            this.render();
            // Draw temporary connection line
            this.drawTempConnection(this.connectionStart, pos);
            return;
        }

        if (this.isResizing && this.resizeHandle) {
            this.handleResize(pos);
            this.render();
            return;
        }

        if (this.isDragging) {
            const dx = pos.x - this.dragOffset.x;
            const dy = pos.y - this.dragOffset.y;

            this.dragStartPositions.forEach(({ element, x, y, x2, y2 }) => {
                element.x = x + dx;
                element.y = y + dy;
                if (element.x2 !== undefined) {
                    element.x2 = x2 + dx;
                    element.y2 = y2 + dy;
                }
            });

            // Update all connections involving moved elements
            this.updateConnections();
            this.render();
            return;
        }

        if (this.isDrawing) {
            if (this.currentTool === 'select') {
                // Selection box
                this.render();
                this.drawSelectionBox(this.drawStart, pos);
            } else if (this.tempElement) {
                // Update temp element
                this.updateTempElement(pos);
                this.render();
                this.drawElement(this.tempElement);
            }
            return;
        }

        // Update cursor based on hover
        this.updateCursor(pos);
    }

    handleMouseUp(e) {
        const pos = this.getMousePos(e);

        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
            return;
        }

        if (this.isConnecting && this.connectionStart) {
            // Check if ending on a shape
            const endElement = this.getElementAtPosition(pos);

            if (endElement && endElement !== this.connectionStart.element &&
                endElement.type !== 'arrow' && endElement.type !== 'line') {
                // Create connection between shapes
                this.createConnection(this.connectionStart.element, endElement);
            }

            this.isConnecting = false;
            this.connectionStart = null;
            this.render();
            return;
        }

        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;
            this.updateConnections();
            this.saveState();
            return;
        }

        if (this.isDragging) {
            this.isDragging = false;
            this.saveState();
            return;
        }

        if (this.isDrawing) {
            this.isDrawing = false;

            if (this.currentTool === 'select') {
                // Complete selection box
                this.selectElementsInBox(this.drawStart, pos);
            } else if (this.tempElement) {
                // Finalize element
                this.finalizeElement(pos);
            }
        }

        this.render();
    }

    handleDoubleClick(e) {
        const pos = this.getMousePos(e);
        const element = this.getElementAtPosition(pos);

        if (element && element.type !== 'arrow' && element.type !== 'line') {
            this.editElementText(element);
        } else if (this.currentTool === 'select') {
            // Create text element on double click
            const fillColor = this.getRandomPastelColor();
            const textElement = this.createElement('text', pos.x - 50, pos.y - 20, pos.x + 50, pos.y + 20);
            textElement.fillColor = fillColor;
            textElement.strokeColor = this.getStrokeForFill(fillColor);
            this.elements.push(textElement);
            this.selectedElements = [textElement];
            this.saveState();
            this.editElementText(textElement);
        }
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, this.zoom * delta));

        // Zoom towards mouse position
        const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
        const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;

        this.panOffset.x = mouseX - (mouseX - this.panOffset.x) * (newZoom / this.zoom);
        this.panOffset.y = mouseY - (mouseY - this.panOffset.y) * (newZoom / this.zoom);

        this.zoom = newZoom;
        this.render();
    }

    // Connection Management
    createConnection(fromElement, toElement) {
        // Check if connection already exists
        const exists = this.connections.some(c =>
            (c.from === fromElement && c.to === toElement) ||
            (c.from === toElement && c.to === fromElement)
        );

        if (!exists) {
            this.connections.push({
                from: fromElement,
                to: toElement,
                strokeColor: '#666666',
                strokeWidth: 2
            });
            this.saveState();
        }
    }

    updateConnections() {
        // Connections auto-update because they reference element objects directly
        // No action needed - render will recalculate paths
    }

    removeConnectionsForElement(element) {
        this.connections = this.connections.filter(c =>
            c.from !== element && c.to !== element
        );
    }

    drawTempConnection(start, endPos) {
        const startCenter = this.getElementCenter(start.element);

        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoom, this.zoom);

        this.ctx.strokeStyle = '#6c5ce7';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        this.ctx.moveTo(startCenter.x, startCenter.y);
        this.ctx.lineTo(endPos.x, endPos.y);
        this.ctx.stroke();

        this.ctx.restore();
    }

    // Get orthogonal path between two elements (Z-shaped arrow)
    getOrthogonalPath(fromElement, toElement) {
        const fromCenter = this.getElementCenter(fromElement);
        const toCenter = this.getElementCenter(toElement);
        const fromBounds = this.getElementBounds(fromElement);
        const toBounds = this.getElementBounds(toElement);

        // Determine best connection points
        const dx = toCenter.x - fromCenter.x;
        const dy = toCenter.y - fromCenter.y;

        let startPoint, endPoint;
        let path = [];

        // Determine which sides to connect based on relative positions
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal dominant - connect left/right sides
            if (dx > 0) {
                // To is to the right
                startPoint = { x: fromBounds.x + fromBounds.width, y: fromCenter.y };
                endPoint = { x: toBounds.x, y: toCenter.y };
            } else {
                // To is to the left
                startPoint = { x: fromBounds.x, y: fromCenter.y };
                endPoint = { x: toBounds.x + toBounds.width, y: toCenter.y };
            }

            // Create Z-path (horizontal -> vertical -> horizontal)
            const midX = (startPoint.x + endPoint.x) / 2;
            path = [
                startPoint,
                { x: midX, y: startPoint.y },
                { x: midX, y: endPoint.y },
                endPoint
            ];
        } else {
            // Vertical dominant - connect top/bottom sides
            if (dy > 0) {
                // To is below
                startPoint = { x: fromCenter.x, y: fromBounds.y + fromBounds.height };
                endPoint = { x: toCenter.x, y: toBounds.y };
            } else {
                // To is above
                startPoint = { x: fromCenter.x, y: fromBounds.y };
                endPoint = { x: toCenter.x, y: toBounds.y + toBounds.height };
            }

            // Create Z-path (vertical -> horizontal -> vertical)
            const midY = (startPoint.y + endPoint.y) / 2;
            path = [
                startPoint,
                { x: startPoint.x, y: midY },
                { x: endPoint.x, y: midY },
                endPoint
            ];
        }

        return path;
    }

    drawConnection(connection) {
        const path = this.getOrthogonalPath(connection.from, connection.to);

        if (path.length < 2) return;

        this.ctx.save();
        this.ctx.strokeStyle = connection.strokeColor || '#666666';
        this.ctx.lineWidth = connection.strokeWidth || 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Draw the path
        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            this.ctx.lineTo(path[i].x, path[i].y);
        }
        this.ctx.stroke();

        // Draw arrowhead at the end
        const lastPoint = path[path.length - 1];
        const prevPoint = path[path.length - 2];
        this.drawArrowhead(prevPoint, lastPoint);

        this.ctx.restore();
    }

    drawArrowhead(from, to) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const headLength = 12;

        this.ctx.beginPath();
        this.ctx.moveTo(to.x, to.y);
        this.ctx.lineTo(
            to.x - headLength * Math.cos(angle - Math.PI / 6),
            to.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(to.x, to.y);
        this.ctx.lineTo(
            to.x - headLength * Math.cos(angle + Math.PI / 6),
            to.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
    }

    getConnectionPointAtPosition(pos) {
        for (let element of this.selectedElements) {
            if (element.type === 'arrow' || element.type === 'line') continue;

            const points = this.getConnectionPoints(element);
            for (let point of points) {
                const dist = Math.sqrt(Math.pow(pos.x - point.x, 2) + Math.pow(pos.y - point.y, 2));
                if (dist < 10) {
                    return { element, point };
                }
            }
        }
        return null;
    }

    getConnectionPoints(element) {
        const bounds = this.getElementBounds(element);
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;

        return [
            { x: cx, y: bounds.y, side: 'top' },
            { x: bounds.x + bounds.width, y: cy, side: 'right' },
            { x: cx, y: bounds.y + bounds.height, side: 'bottom' },
            { x: bounds.x, y: cy, side: 'left' }
        ];
    }

    // Keyboard Handler
    handleKeyDown(e) {
        // Don't handle if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        const key = e.key.toLowerCase();

        // Handle Tab and Enter for creating connected shapes
        if (e.key === 'Tab' && this.selectedElements.length === 1) {
            e.preventDefault();
            this.createChildShape();
            return;
        }

        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && this.selectedElements.length === 1) {
            e.preventDefault();
            this.createSiblingShape();
            return;
        }

        // Handle Escape - cancel arrow connection mode or deselect
        if (e.key === 'Escape') {
            if (this.isArrowConnectionMode) {
                this.cancelArrowConnectionMode();
            } else {
                this.selectedElements = [];
            }
            this.render();
            this.updatePropertyPanel();
            return;
        }

        // Tool shortcuts
        if (!e.ctrlKey && !e.metaKey) {
            switch (key) {
                case 'v':
                    this.setTool('select');
                    return;
                case 'r':
                    this.setTool('rect');
                    return;
                case 'c':
                    this.setTool('circle');
                    return;
                case 'd':
                    this.setTool('diamond');
                    return;
                case 't':
                    this.setTool('triangle');
                    return;
                case 'a':
                    // Enter arrow connection mode
                    this.startArrowConnectionMode();
                    return;
                case 'l':
                    this.setTool('line');
                    return;
                case 'x':
                    this.setTool('text');
                    return;
                case 'delete':
                case 'backspace':
                    this.deleteSelected();
                    return;
            }

            // Direct text typing on selected shape - if a printable character is pressed
            if (this.selectedElements.length === 1 && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                const element = this.selectedElements[0];
                if (element.type !== 'arrow' && element.type !== 'line') {
                    // Start editing with the typed character
                    this.editElementTextWithInitialChar(element, e.key);
                    e.preventDefault();
                    return;
                }
            }
        }

        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (key) {
                case 'c':
                    e.preventDefault();
                    this.copy();
                    return;
                case 'v':
                    // Let paste event handle images
                    if (this.clipboard.length > 0) {
                        e.preventDefault();
                        this.paste();
                    }
                    return;
                case 'x':
                    e.preventDefault();
                    this.cut();
                    return;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    return;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    return;
                case 'a':
                    e.preventDefault();
                    this.selectAll();
                    return;
                case 's':
                    e.preventDefault();
                    this.showSaveModal();
                    return;
                case 'o':
                    e.preventDefault();
                    this.showLoadModal();
                    return;
                case 'd':
                    e.preventDefault();
                    this.duplicate();
                    return;
            }
        }
    }

    // Paste Handler
    handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                this.addImageFromFile(file);
                return;
            }
        }
    }

    // Drop Handler
    handleDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (!files) return;

        for (let file of files) {
            if (file.type.startsWith('image/')) {
                this.addImageFromFile(file, this.getMousePos(e));
                break;
            }
        }
    }

    addImageFromFile(file, pos = null) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const x = pos ? pos.x : this.canvas.width / 2 - img.width / 2;
                const y = pos ? pos.y : this.canvas.height / 2 - img.height / 2;

                // Scale down large images
                let width = img.width;
                let height = img.height;
                const maxSize = 400;

                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width *= ratio;
                    height *= ratio;
                }

                const imageElement = {
                    type: 'image',
                    x: x - width / 2,
                    y: y - height / 2,
                    width: width,
                    height: height,
                    imageData: event.target.result,
                    image: img,
                    text: ''
                };

                this.elements.push(imageElement);
                this.selectedElements = [imageElement];
                this.saveState();
                this.render();
                this.updatePropertyPanel();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Element Creation
    createElement(type, x1, y1, x2, y2) {
        const fillColor = this.getRandomPastelColor();
        const strokeColor = this.getStrokeForFill(fillColor);

        const baseElement = {
            type: type,
            fillColor: fillColor,
            strokeColor: strokeColor,
            strokeWidth: this.strokeWidth,
            text: '',
            fontSize: this.fontSize,
            textAlign: 'center'
        };

        switch (type) {
            case 'rect':
            case 'circle':
            case 'diamond':
            case 'triangle':
            case 'text':
                return {
                    ...baseElement,
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x2 - x1) || this.defaultWidth,
                    height: Math.abs(y2 - y1) || this.defaultHeight
                };
            case 'arrow':
            case 'line':
                return {
                    ...baseElement,
                    x: x1,
                    y: y1,
                    x2: x2,
                    y2: y2,
                    fillColor: 'transparent',
                    strokeColor: '#666666'
                };
            default:
                return baseElement;
        }
    }

    updateTempElement(pos) {
        if (!this.tempElement) return;

        const type = this.tempElement.type;

        if (type === 'arrow' || type === 'line') {
            this.tempElement.x2 = pos.x;
            this.tempElement.y2 = pos.y;
        } else {
            this.tempElement.x = Math.min(this.drawStart.x, pos.x);
            this.tempElement.y = Math.min(this.drawStart.y, pos.y);
            this.tempElement.width = Math.abs(pos.x - this.drawStart.x);
            this.tempElement.height = Math.abs(pos.y - this.drawStart.y);
        }
    }

    finalizeElement(pos) {
        if (!this.tempElement) return;

        // Minimum size check
        const minSize = 10;
        let valid = true;

        if (this.tempElement.type === 'arrow' || this.tempElement.type === 'line') {
            const dx = this.tempElement.x2 - this.tempElement.x;
            const dy = this.tempElement.y2 - this.tempElement.y;
            valid = Math.sqrt(dx * dx + dy * dy) > minSize;
        } else {
            valid = this.tempElement.width > minSize || this.tempElement.height > minSize;
        }

        if (valid) {
            this.elements.push(this.tempElement);
            this.selectedElements = [this.tempElement];
            this.saveState();

            // If text tool, start editing
            if (this.tempElement.type === 'text') {
                this.editElementText(this.tempElement);
            }
        }

        this.tempElement = null;
        this.updatePropertyPanel();
    }

    getElementCenter(element) {
        const bounds = this.getElementBounds(element);
        return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
        };
    }

    // Rendering
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply pan and zoom
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoom, this.zoom);

        // Draw all connections first (behind shapes)
        this.connections.forEach(connection => {
            // Check if both elements still exist
            if (this.elements.includes(connection.from) && this.elements.includes(connection.to)) {
                this.drawConnection(connection);
            }
        });

        // Draw all elements
        this.elements.forEach(element => {
            this.drawElement(element);
        });

        // Draw selection indicators
        this.selectedElements.forEach(element => {
            this.drawSelectionIndicator(element);
        });

        this.ctx.restore();
    }

    drawElement(element) {
        this.ctx.save();
        this.ctx.fillStyle = element.fillColor || this.fillColor;
        this.ctx.strokeStyle = element.strokeColor || this.strokeColor;
        this.ctx.lineWidth = element.strokeWidth || this.strokeWidth;

        switch (element.type) {
            case 'rect':
                this.drawRect(element);
                break;
            case 'circle':
                this.drawCircle(element);
                break;
            case 'diamond':
                this.drawDiamond(element);
                break;
            case 'triangle':
                this.drawTriangle(element);
                break;
            case 'arrow':
                this.drawArrow(element);
                break;
            case 'line':
                this.drawLine(element);
                break;
            case 'text':
                this.drawText(element);
                break;
            case 'image':
                this.drawImage(element);
                break;
        }

        this.ctx.restore();
    }

    drawRect(element) {
        const { x, y, width, height } = element;
        const radius = Math.min(8, width / 4, height / 4);

        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, radius);
        this.ctx.fill();
        this.ctx.stroke();

        this.drawElementText(element);
    }

    drawCircle(element) {
        const { x, y, width, height } = element;
        const rx = width / 2;
        const ry = height / 2;
        const cx = x + rx;
        const cy = y + ry;

        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        this.drawElementText(element);
    }

    drawDiamond(element) {
        const { x, y, width, height } = element;
        const cx = x + width / 2;
        const cy = y + height / 2;

        this.ctx.beginPath();
        this.ctx.moveTo(cx, y);
        this.ctx.lineTo(x + width, cy);
        this.ctx.lineTo(cx, y + height);
        this.ctx.lineTo(x, cy);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.drawElementText(element);
    }

    drawTriangle(element) {
        const { x, y, width, height } = element;

        this.ctx.beginPath();
        this.ctx.moveTo(x + width / 2, y);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.lineTo(x, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.drawElementText(element);
    }

    drawArrow(element) {
        const { x, y, x2, y2 } = element;

        // Draw line
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(y2 - y, x2 - x);
        const headLength = 15;

        this.ctx.beginPath();
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
    }

    drawLine(element) {
        const { x, y, x2, y2 } = element;

        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    // Wrap text to fit within a given width
    wrapText(text, maxWidth, fontSize, ctx) {
        if (!text) return [];

        const font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.font = font;

        const paragraphs = text.split('\n');
        const lines = [];

        paragraphs.forEach(paragraph => {
            if (paragraph === '') {
                lines.push('');
                return;
            }

            const words = paragraph.split(' ');
            let currentLine = '';

            words.forEach(word => {
                const testLine = currentLine ? currentLine + ' ' + word : word;
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            });

            if (currentLine) {
                lines.push(currentLine);
            }
        });

        return lines;
    }

    // Calculate optimal font size to fit text within shape bounds
    // Strategy: first wrap text, then reduce font size if needed to fit height
    calculateOptimalFontSize(text, maxWidth, maxHeight, baseFontSize, ctx, padding = 10) {
        if (!text) return { fontSize: baseFontSize, lines: [] };

        const minFontSize = 8;
        const lineHeightRatio = 1.3;
        let fontSize = baseFontSize;

        // Available space after padding
        const availableWidth = maxWidth - padding * 2;
        const availableHeight = maxHeight - padding * 2;

        while (fontSize >= minFontSize) {
            const lines = this.wrapText(text, availableWidth, fontSize, ctx);
            const totalTextHeight = lines.length * fontSize * lineHeightRatio;

            if (totalTextHeight <= availableHeight) {
                return { fontSize, lines };
            }

            fontSize -= 1;
        }

        // Return minimum font size even if it doesn't fit perfectly
        const lines = this.wrapText(text, availableWidth, minFontSize, ctx);
        return { fontSize: minFontSize, lines };
    }

    // Render text with crisp quality at any zoom level
    // This renders text outside the zoom transform for pixel-perfect clarity
    renderCrispText(lines, centerX, centerY, fontSize, maxHeight, padding = 10) {
        if (lines.length === 0) return;

        // Calculate screen-space coordinates
        const screenX = centerX * this.zoom + this.panOffset.x;
        const screenY = centerY * this.zoom + this.panOffset.y;
        const screenFontSize = fontSize * this.zoom;
        const lineHeight = fontSize * 1.3 * this.zoom;

        // Save current state and reset transform for crisp text rendering
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity matrix

        // Set text properties with scaled font size
        this.ctx.fillStyle = '#333333';
        this.ctx.font = `${screenFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Calculate starting Y position to center text block vertically
        const totalTextHeight = lines.length * lineHeight;
        const startY = screenY - totalTextHeight / 2 + lineHeight / 2;

        // Draw each line
        lines.forEach((line, i) => {
            this.ctx.fillText(line, screenX, startY + i * lineHeight);
        });

        this.ctx.restore();
    }

    drawText(element) {
        const { x, y, width, height, text, fontSize } = element;

        // Draw background if has fill color
        if (element.fillColor && element.fillColor !== 'transparent') {
            this.ctx.fillStyle = element.fillColor;
            this.ctx.fillRect(x, y, width, height);
            this.ctx.strokeRect(x, y, width, height);
        }

        // Draw text with crisp rendering, auto-wrapping, and auto-sizing
        if (text) {
            const baseFontSize = fontSize || 14;
            const padding = 8;

            // Calculate optimal font size with text wrapping
            const { fontSize: optimalFontSize, lines } = this.calculateOptimalFontSize(
                text, width, height, baseFontSize, this.ctx, padding
            );

            // Render crisp text at center of element
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            this.renderCrispText(lines, centerX, centerY, optimalFontSize, height, padding);
        }
    }

    drawImage(element) {
        if (element.image) {
            this.ctx.drawImage(element.image, element.x, element.y, element.width, element.height);
        } else if (element.imageData) {
            // Recreate image if needed
            const img = new Image();
            img.src = element.imageData;
            element.image = img;
            img.onload = () => this.render();
        }
    }

    drawElementText(element) {
        if (!element.text) return;

        const width = element.width || 0;
        const height = element.height || 0;
        const baseFontSize = element.fontSize || 14;

        // Calculate padding based on shape type
        // Diamonds and triangles need more padding due to their shape
        let padding = 10;
        if (element.type === 'diamond') {
            padding = Math.min(width, height) * 0.25;
        } else if (element.type === 'triangle') {
            padding = Math.min(width, height) * 0.2;
        } else if (element.type === 'circle') {
            // For circles/ellipses, use more padding on sides
            padding = Math.min(width, height) * 0.15;
        }

        // Calculate optimal font size with text wrapping
        const { fontSize: optimalFontSize, lines } = this.calculateOptimalFontSize(
            element.text, width, height, baseFontSize, this.ctx, padding
        );

        // Render crisp text at center of element
        const centerX = element.x + width / 2;
        const centerY = element.y + height / 2;
        this.renderCrispText(lines, centerX, centerY, optimalFontSize, height, padding);
    }

    drawSelectionIndicator(element) {
        const bounds = this.getElementBounds(element);
        const padding = 5;

        this.ctx.strokeStyle = '#6c5ce7';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            bounds.x - padding,
            bounds.y - padding,
            bounds.width + padding * 2,
            bounds.height + padding * 2
        );
        this.ctx.setLineDash([]);

        // Draw resize handles
        const handleSize = 8;
        const handles = this.getResizeHandles(element);

        this.ctx.fillStyle = '#6c5ce7';
        handles.forEach(handle => {
            this.ctx.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
        });

        // Draw connection points for shapes
        if (element.type !== 'arrow' && element.type !== 'line') {
            const connectionPoints = this.getConnectionPoints(element);
            this.ctx.fillStyle = '#00b894';
            connectionPoints.forEach(point => {
                this.ctx.beginPath();
                this.ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    }

    drawSelectionBox(start, end) {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);

        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoom, this.zoom);

        this.ctx.strokeStyle = '#6c5ce7';
        this.ctx.fillStyle = 'rgba(108, 92, 231, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);

        this.ctx.fillRect(x, y, width, height);
        this.ctx.strokeRect(x, y, width, height);

        this.ctx.restore();
    }

    // Helper Methods
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.panOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.panOffset.y) / this.zoom;
        return { x, y };
    }

    getElementBounds(element) {
        if (element.type === 'arrow' || element.type === 'line') {
            return {
                x: Math.min(element.x, element.x2),
                y: Math.min(element.y, element.y2),
                width: Math.abs(element.x2 - element.x) || 10,
                height: Math.abs(element.y2 - element.y) || 10
            };
        }
        return {
            x: element.x,
            y: element.y,
            width: element.width || 0,
            height: element.height || 0
        };
    }

    getElementAtPosition(pos) {
        // Check in reverse order (top elements first)
        for (let i = this.elements.length - 1; i >= 0; i--) {
            if (this.isPointInElement(pos, this.elements[i])) {
                return this.elements[i];
            }
        }
        return null;
    }

    isPointInElement(pos, element) {
        const bounds = this.getElementBounds(element);
        const padding = 5;

        return pos.x >= bounds.x - padding &&
               pos.x <= bounds.x + bounds.width + padding &&
               pos.y >= bounds.y - padding &&
               pos.y <= bounds.y + bounds.height + padding;
    }

    getResizeHandles(element) {
        const bounds = this.getElementBounds(element);
        const { x, y, width, height } = bounds;

        if (element.type === 'arrow' || element.type === 'line') {
            return [
                { x: element.x, y: element.y, type: 'start' },
                { x: element.x2, y: element.y2, type: 'end' }
            ];
        }

        return [
            { x: x, y: y, type: 'nw' },
            { x: x + width, y: y, type: 'ne' },
            { x: x + width, y: y + height, type: 'se' },
            { x: x, y: y + height, type: 'sw' },
            { x: x + width / 2, y: y, type: 'n' },
            { x: x + width, y: y + height / 2, type: 'e' },
            { x: x + width / 2, y: y + height, type: 's' },
            { x: x, y: y + height / 2, type: 'w' }
        ];
    }

    getResizeHandle(pos) {
        for (let element of this.selectedElements) {
            const handles = this.getResizeHandles(element);
            for (let handle of handles) {
                const dist = Math.sqrt(
                    Math.pow(pos.x - handle.x, 2) + Math.pow(pos.y - handle.y, 2)
                );
                if (dist < 10) {
                    return { element, handle };
                }
            }
        }
        return null;
    }

    handleResize(pos) {
        const { element, handle } = this.resizeHandle;

        if (element.type === 'arrow' || element.type === 'line') {
            if (handle.type === 'start') {
                element.x = pos.x;
                element.y = pos.y;
            } else {
                element.x2 = pos.x;
                element.y2 = pos.y;
            }
            return;
        }

        const bounds = this.getElementBounds(element);
        let newX = element.x;
        let newY = element.y;
        let newWidth = element.width;
        let newHeight = element.height;

        switch (handle.type) {
            case 'nw':
                newWidth = bounds.x + bounds.width - pos.x;
                newHeight = bounds.y + bounds.height - pos.y;
                newX = pos.x;
                newY = pos.y;
                break;
            case 'ne':
                newWidth = pos.x - element.x;
                newHeight = bounds.y + bounds.height - pos.y;
                newY = pos.y;
                break;
            case 'se':
                newWidth = pos.x - element.x;
                newHeight = pos.y - element.y;
                break;
            case 'sw':
                newWidth = bounds.x + bounds.width - pos.x;
                newHeight = pos.y - element.y;
                newX = pos.x;
                break;
            case 'n':
                newHeight = bounds.y + bounds.height - pos.y;
                newY = pos.y;
                break;
            case 'e':
                newWidth = pos.x - element.x;
                break;
            case 's':
                newHeight = pos.y - element.y;
                break;
            case 'w':
                newWidth = bounds.x + bounds.width - pos.x;
                newX = pos.x;
                break;
        }

        // Minimum size
        if (newWidth > 20) {
            element.x = newX;
            element.width = newWidth;
        }
        if (newHeight > 20) {
            element.y = newY;
            element.height = newHeight;
        }
    }

    updateCursor(pos) {
        const handle = this.getResizeHandle(pos);
        if (handle) {
            const type = handle.handle.type;
            const cursors = {
                'nw': 'nw-resize', 'ne': 'ne-resize',
                'se': 'se-resize', 'sw': 'sw-resize',
                'n': 'n-resize', 's': 's-resize',
                'e': 'e-resize', 'w': 'w-resize',
                'start': 'move', 'end': 'move'
            };
            this.canvas.style.cursor = cursors[type] || 'move';
            return;
        }

        const element = this.getElementAtPosition(pos);
        if (element && this.currentTool === 'select') {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
        }
    }

    selectElementsInBox(start, end) {
        const x1 = Math.min(start.x, end.x);
        const y1 = Math.min(start.y, end.y);
        const x2 = Math.max(start.x, end.x);
        const y2 = Math.max(start.y, end.y);

        // Only select if box is bigger than a click
        if (Math.abs(x2 - x1) < 5 && Math.abs(y2 - y1) < 5) {
            return;
        }

        this.elements.forEach(element => {
            const bounds = this.getElementBounds(element);
            if (bounds.x >= x1 && bounds.x + bounds.width <= x2 &&
                bounds.y >= y1 && bounds.y + bounds.height <= y2) {
                if (!this.selectedElements.includes(element)) {
                    this.selectedElements.push(element);
                }
            }
        });

        this.updatePropertyPanel();
    }

    // Clipboard Operations
    copy() {
        if (this.selectedElements.length === 0) return;

        this.clipboard = this.selectedElements.map(el => ({
            ...el,
            image: undefined // Don't copy image objects
        }));
    }

    cut() {
        this.copy();
        this.deleteSelected();
    }

    paste() {
        if (this.clipboard.length === 0) return;

        const offset = 20;
        const newElements = this.clipboard.map(el => {
            const newEl = { ...el };
            newEl.x += offset;
            newEl.y += offset;
            if (newEl.x2 !== undefined) {
                newEl.x2 += offset;
                newEl.y2 += offset;
            }

            // Recreate image if needed
            if (newEl.type === 'image' && newEl.imageData) {
                const img = new Image();
                img.src = newEl.imageData;
                newEl.image = img;
            }

            return newEl;
        });

        this.elements.push(...newElements);
        this.selectedElements = newElements;
        this.saveState();
        this.render();
        this.updatePropertyPanel();
    }

    duplicate() {
        if (this.selectedElements.length === 0) return;

        const offset = 20;
        const newElements = this.selectedElements.map(el => {
            const newEl = { ...el };
            newEl.x += offset;
            newEl.y += offset;
            if (newEl.x2 !== undefined) {
                newEl.x2 += offset;
                newEl.y2 += offset;
            }

            if (newEl.type === 'image' && newEl.imageData) {
                const img = new Image();
                img.src = newEl.imageData;
                newEl.image = img;
            }

            return newEl;
        });

        this.elements.push(...newElements);
        this.selectedElements = newElements;
        this.saveState();
        this.render();
        this.updatePropertyPanel();
    }

    // History Operations
    saveState() {
        // Remove any future states
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Save current state (elements and connections)
        const state = {
            elements: this.elements.map(el => ({
                ...el,
                image: undefined
            })),
            connections: this.connections.map(c => ({
                fromIndex: this.elements.indexOf(c.from),
                toIndex: this.elements.indexOf(c.to),
                strokeColor: c.strokeColor,
                strokeWidth: c.strokeWidth
            }))
        };

        this.history.push(JSON.stringify(state));
        this.historyIndex = this.history.length - 1;

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex <= 0) return;

        this.historyIndex--;
        this.loadState(this.history[this.historyIndex]);
    }

    redo() {
        if (this.historyIndex >= this.history.length - 1) return;

        this.historyIndex++;
        this.loadState(this.history[this.historyIndex]);
    }

    loadState(stateJson) {
        const state = JSON.parse(stateJson);

        // Recreate elements
        this.elements = state.elements.map(el => {
            if (el.type === 'image' && el.imageData) {
                const img = new Image();
                img.src = el.imageData;
                el.image = img;
            }
            return el;
        });

        // Recreate connections
        this.connections = state.connections
            .filter(c => c.fromIndex >= 0 && c.toIndex >= 0)
            .map(c => ({
                from: this.elements[c.fromIndex],
                to: this.elements[c.toIndex],
                strokeColor: c.strokeColor,
                strokeWidth: c.strokeWidth
            }));

        this.selectedElements = [];
        this.render();
        this.updatePropertyPanel();
    }

    // Element Operations
    deleteSelected() {
        if (this.selectedElements.length === 0) return;

        // Remove connections for deleted elements
        this.selectedElements.forEach(el => {
            this.removeConnectionsForElement(el);
        });

        this.elements = this.elements.filter(el => !this.selectedElements.includes(el));
        this.selectedElements = [];
        this.saveState();
        this.render();
        this.updatePropertyPanel();
    }

    selectAll() {
        this.selectedElements = [...this.elements];
        this.render();
        this.updatePropertyPanel();
    }

    clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas?')) {
            this.elements = [];
            this.connections = [];
            this.selectedElements = [];
            this.saveState();
            this.render();
            this.updatePropertyPanel();
        }
    }

    // Text Editing
    editElementText(element) {
        const bounds = this.getElementBounds(element);

        // Create text input overlay
        let overlay = document.getElementById('textInputOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'textInputOverlay';
            document.getElementById('canvasContainer').appendChild(overlay);
        }

        const textarea = document.createElement('textarea');
        textarea.value = element.text || '';
        textarea.style.width = Math.max(bounds.width, 100) + 'px';
        textarea.style.height = Math.max(bounds.height, 40) + 'px';
        textarea.style.fontSize = (element.fontSize || 14) + 'px';
        textarea.style.textAlign = 'center';

        overlay.innerHTML = '';
        overlay.appendChild(textarea);
        overlay.style.display = 'block';
        overlay.style.left = (bounds.x * this.zoom + this.panOffset.x) + 'px';
        overlay.style.top = (bounds.y * this.zoom + this.panOffset.y) + 'px';

        textarea.focus();
        textarea.select();

        const finishEdit = () => {
            element.text = textarea.value;
            overlay.style.display = 'none';
            this.saveState();
            this.render();
        };

        textarea.addEventListener('blur', finishEdit);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                overlay.style.display = 'none';
                this.render();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finishEdit();
            }
        });
    }

    // Text Editing with initial character (for direct typing on selected shape)
    editElementTextWithInitialChar(element, initialChar) {
        const bounds = this.getElementBounds(element);

        // Create text input overlay
        let overlay = document.getElementById('textInputOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'textInputOverlay';
            document.getElementById('canvasContainer').appendChild(overlay);
        }

        const textarea = document.createElement('textarea');
        // Replace existing text with the initial character
        textarea.value = initialChar;
        textarea.style.width = Math.max(bounds.width, 100) + 'px';
        textarea.style.height = Math.max(bounds.height, 40) + 'px';
        textarea.style.fontSize = (element.fontSize || 14) + 'px';
        textarea.style.textAlign = 'center';

        overlay.innerHTML = '';
        overlay.appendChild(textarea);
        overlay.style.display = 'block';
        overlay.style.left = (bounds.x * this.zoom + this.panOffset.x) + 'px';
        overlay.style.top = (bounds.y * this.zoom + this.panOffset.y) + 'px';

        textarea.focus();
        // Move cursor to end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        const finishEdit = () => {
            element.text = textarea.value;
            overlay.style.display = 'none';
            this.saveState();
            this.render();
        };

        textarea.addEventListener('blur', finishEdit);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                overlay.style.display = 'none';
                this.render();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                finishEdit();
            }
        });
    }

    // Arrow Connection Mode (press A, click origin, click target)
    startArrowConnectionMode() {
        this.isArrowConnectionMode = true;
        this.arrowConnectionOrigin = null;
        this.setTool('select');
        this.canvas.style.cursor = 'crosshair';
        this.showArrowModeIndicator('Click origin shape');
    }

    cancelArrowConnectionMode() {
        this.isArrowConnectionMode = false;
        this.arrowConnectionOrigin = null;
        this.canvas.style.cursor = 'default';
        this.hideArrowModeIndicator();
    }

    showArrowModeIndicator(message) {
        let indicator = document.getElementById('arrowModeIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'arrowModeIndicator';
            indicator.style.cssText = `
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                background: #6c5ce7;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.body.appendChild(indicator);
        }
        indicator.textContent = message;
        indicator.style.display = 'block';
    }

    hideArrowModeIndicator() {
        const indicator = document.getElementById('arrowModeIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    handleArrowConnectionClick(pos) {
        const clickedElement = this.getElementAtPosition(pos);

        if (!clickedElement || clickedElement.type === 'arrow' || clickedElement.type === 'line') {
            // Clicked on empty space or non-shape - cancel mode
            this.cancelArrowConnectionMode();
            return false;
        }

        if (!this.arrowConnectionOrigin) {
            // First click - set origin
            this.arrowConnectionOrigin = clickedElement;
            this.selectedElements = [clickedElement];
            this.showArrowModeIndicator('Click target shape');
            this.render();
            return true;
        } else {
            // Second click - set target and create connection
            if (clickedElement !== this.arrowConnectionOrigin) {
                this.createConnection(this.arrowConnectionOrigin, clickedElement);
                this.selectedElements = [clickedElement];
            }
            this.cancelArrowConnectionMode();
            this.render();
            return true;
        }
    }

    // Create child shape (Tab key) - creates shape to the right with connection
    createChildShape() {
        if (this.selectedElements.length !== 1) return;

        const parent = this.selectedElements[0];
        if (parent.type === 'arrow' || parent.type === 'line') return;

        const parentBounds = this.getElementBounds(parent);
        const fillColor = this.getRandomPastelColor();
        const strokeColor = this.getStrokeForFill(fillColor);

        // Position child to the right of parent
        const spacing = 50;
        const newX = parentBounds.x + parentBounds.width + spacing;
        const newY = parentBounds.y;

        const child = this.createElement(
            parent.type,
            newX,
            newY,
            newX + this.defaultWidth,
            newY + this.defaultHeight
        );
        child.fillColor = fillColor;
        child.strokeColor = strokeColor;

        this.elements.push(child);
        this.createConnection(parent, child);
        this.selectedElements = [child];
        this.saveState();
        this.render();
        this.updatePropertyPanel();

        // Start editing the new shape
        this.editElementText(child);
    }

    // Create sibling shape (Enter key) - creates shape below at same level
    createSiblingShape() {
        if (this.selectedElements.length !== 1) return;

        const current = this.selectedElements[0];
        if (current.type === 'arrow' || current.type === 'line') return;

        const currentBounds = this.getElementBounds(current);
        const fillColor = this.getRandomPastelColor();
        const strokeColor = this.getStrokeForFill(fillColor);

        // Position sibling below current
        const spacing = 30;
        const newX = currentBounds.x;
        const newY = currentBounds.y + currentBounds.height + spacing;

        const sibling = this.createElement(
            current.type,
            newX,
            newY,
            newX + currentBounds.width,
            newY + currentBounds.height
        );
        sibling.fillColor = fillColor;
        sibling.strokeColor = strokeColor;

        this.elements.push(sibling);

        // Find parent connection and connect sibling to same parent
        const parentConnection = this.connections.find(c => c.to === current);
        if (parentConnection) {
            this.createConnection(parentConnection.from, sibling);
        }

        this.selectedElements = [sibling];
        this.saveState();
        this.render();
        this.updatePropertyPanel();

        // Start editing the new shape
        this.editElementText(sibling);
    }

    // Toolbar Setup
    setupToolbar() {
        const tools = ['select', 'rect', 'circle', 'diamond', 'triangle', 'arrow', 'line', 'text'];

        tools.forEach(tool => {
            const btn = document.getElementById(tool + 'Tool');
            if (btn) {
                btn.addEventListener('click', () => this.setTool(tool));
            }
        });

        // Color pickers
        document.getElementById('fillColor').addEventListener('input', (e) => {
            this.fillColor = e.target.value;
            this.selectedElements.forEach(el => {
                if (el.type !== 'arrow' && el.type !== 'line') {
                    el.fillColor = e.target.value;
                }
            });
            this.render();
        });

        document.getElementById('strokeColor').addEventListener('input', (e) => {
            this.strokeColor = e.target.value;
            this.selectedElements.forEach(el => {
                el.strokeColor = e.target.value;
            });
            this.render();
        });

        document.getElementById('strokeWidth').addEventListener('input', (e) => {
            this.strokeWidth = parseInt(e.target.value);
            this.selectedElements.forEach(el => {
                el.strokeWidth = parseInt(e.target.value);
            });
            this.render();
        });

        // Action buttons
        document.getElementById('saveBtn').addEventListener('click', () => this.showSaveModal());
        document.getElementById('loadBtn').addEventListener('click', () => this.showLoadModal());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportAsPng());
    }

    setTool(tool) {
        this.currentTool = tool;

        // Update toolbar UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const btn = document.getElementById(tool + 'Tool');
        if (btn) {
            btn.classList.add('active');
        }

        this.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    }

    // Property Panel
    setupPropertyPanel() {
        const elementText = document.getElementById('elementText');
        const elementFill = document.getElementById('elementFill');
        const elementStroke = document.getElementById('elementStroke');
        const elementStrokeWidth = document.getElementById('elementStrokeWidth');
        const elementFontSize = document.getElementById('elementFontSize');
        const deleteBtn = document.getElementById('deleteElement');

        elementText.addEventListener('input', (e) => {
            this.selectedElements.forEach(el => {
                el.text = e.target.value;
            });
            this.render();
        });

        elementText.addEventListener('change', () => {
            this.saveState();
        });

        elementFill.addEventListener('input', (e) => {
            this.selectedElements.forEach(el => {
                el.fillColor = e.target.value;
            });
            this.render();
        });

        elementFill.addEventListener('change', () => {
            this.saveState();
        });

        elementStroke.addEventListener('input', (e) => {
            this.selectedElements.forEach(el => {
                el.strokeColor = e.target.value;
            });
            this.render();
        });

        elementStroke.addEventListener('change', () => {
            this.saveState();
        });

        elementStrokeWidth.addEventListener('input', (e) => {
            this.selectedElements.forEach(el => {
                el.strokeWidth = parseInt(e.target.value);
            });
            this.render();
        });

        elementStrokeWidth.addEventListener('change', () => {
            this.saveState();
        });

        elementFontSize.addEventListener('input', (e) => {
            this.selectedElements.forEach(el => {
                el.fontSize = parseInt(e.target.value);
            });
            this.render();
        });

        elementFontSize.addEventListener('change', () => {
            this.saveState();
        });

        deleteBtn.addEventListener('click', () => {
            this.deleteSelected();
        });
    }

    updatePropertyPanel() {
        const noSelection = document.getElementById('noSelection');
        const elementProperties = document.getElementById('elementProperties');

        if (this.selectedElements.length === 0) {
            noSelection.style.display = 'block';
            elementProperties.style.display = 'none';
            return;
        }

        noSelection.style.display = 'none';
        elementProperties.style.display = 'block';

        const element = this.selectedElements[0];

        document.getElementById('elementText').value = element.text || '';
        document.getElementById('elementFill').value = element.fillColor || '#BAE1FF';
        document.getElementById('elementStroke').value = element.strokeColor || '#5DADE2';
        document.getElementById('elementStrokeWidth').value = element.strokeWidth || 2;
        document.getElementById('elementFontSize').value = element.fontSize || 14;
    }

    // Modal Setup
    setupModals() {
        // Save Modal
        document.getElementById('closeSaveModal').addEventListener('click', () => {
            document.getElementById('saveModal').style.display = 'none';
        });

        document.getElementById('confirmSave').addEventListener('click', () => {
            this.saveMindmap();
        });

        // Load Modal
        document.getElementById('closeLoadModal').addEventListener('click', () => {
            document.getElementById('loadModal').style.display = 'none';
        });

        // Close modals on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    showSaveModal() {
        if (!FirebaseService.isConfigured()) {
            alert('Firebase is not configured. Please update js/firebase-config.js with your Firebase credentials.');
            return;
        }

        if (!FirebaseService.getCurrentUser()) {
            alert('Please sign in to save your mindmap.');
            return;
        }

        document.getElementById('saveModal').style.display = 'flex';
        document.getElementById('mindmapName').focus();
    }

    async saveMindmap() {
        const name = document.getElementById('mindmapName').value.trim();
        if (!name) {
            alert('Please enter a name for your mindmap.');
            return;
        }

        try {
            const data = {
                elements: this.elements.map(el => ({
                    ...el,
                    image: undefined
                })),
                connections: this.connections.map(c => ({
                    fromIndex: this.elements.indexOf(c.from),
                    toIndex: this.elements.indexOf(c.to),
                    strokeColor: c.strokeColor,
                    strokeWidth: c.strokeWidth
                }))
            };

            await FirebaseService.saveMindmap(name, data);
            document.getElementById('saveModal').style.display = 'none';
            alert('Mindmap saved successfully!');
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save mindmap: ' + error.message);
        }
    }

    showLoadModal() {
        if (!FirebaseService.isConfigured()) {
            alert('Firebase is not configured. Please update js/firebase-config.js with your Firebase credentials.');
            return;
        }

        if (!FirebaseService.getCurrentUser()) {
            alert('Please sign in to load your mindmaps.');
            return;
        }

        document.getElementById('loadModal').style.display = 'flex';
        this.loadMindmapsList();
    }

    async loadMindmapsList() {
        const listEl = document.getElementById('mindmapList');
        listEl.innerHTML = '<p>Loading...</p>';

        try {
            const mindmaps = await FirebaseService.loadMindmapsList();

            if (mindmaps.length === 0) {
                listEl.innerHTML = '<p>No saved mindmaps found.</p>';
                return;
            }

            listEl.innerHTML = '';
            mindmaps.forEach(mindmap => {
                const item = document.createElement('div');
                item.className = 'mindmap-item';
                item.innerHTML = `
                    <div>
                        <div class="name">${mindmap.name}</div>
                        <div class="date">${mindmap.updatedAt.toLocaleDateString()}</div>
                    </div>
                    <button class="delete-btn" title="Delete">X</button>
                `;

                item.querySelector('.name').addEventListener('click', () => {
                    this.loadMindmap(mindmap.id);
                });

                item.querySelector('.delete-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm('Delete this mindmap?')) {
                        await FirebaseService.deleteMindmap(mindmap.id);
                        this.loadMindmapsList();
                    }
                });

                listEl.appendChild(item);
            });
        } catch (error) {
            console.error('Load list error:', error);
            listEl.innerHTML = '<p>Failed to load mindmaps.</p>';
        }
    }

    async loadMindmap(id) {
        try {
            const mindmap = await FirebaseService.loadMindmap(id);

            // Handle both old format (array) and new format (object with elements/connections)
            let elementsData, connectionsData;

            if (Array.isArray(mindmap.data)) {
                elementsData = mindmap.data;
                connectionsData = [];
            } else {
                elementsData = mindmap.data.elements || [];
                connectionsData = mindmap.data.connections || [];
            }

            this.elements = elementsData.map(el => {
                if (el.type === 'image' && el.imageData) {
                    const img = new Image();
                    img.src = el.imageData;
                    el.image = img;
                }
                return el;
            });

            // Recreate connections
            this.connections = connectionsData
                .filter(c => c.fromIndex >= 0 && c.toIndex >= 0 &&
                            c.fromIndex < this.elements.length &&
                            c.toIndex < this.elements.length)
                .map(c => ({
                    from: this.elements[c.fromIndex],
                    to: this.elements[c.toIndex],
                    strokeColor: c.strokeColor || '#666666',
                    strokeWidth: c.strokeWidth || 2
                }));

            this.selectedElements = [];
            this.history = [];
            this.historyIndex = -1;
            this.saveState();

            document.getElementById('loadModal').style.display = 'none';
            this.render();
        } catch (error) {
            console.error('Load error:', error);
            alert('Failed to load mindmap: ' + error.message);
        }
    }

    exportAsPng() {
        // Create a temporary canvas with white background
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Calculate bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.elements.forEach(el => {
            const bounds = this.getElementBounds(el);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        if (this.elements.length === 0) {
            minX = 0;
            minY = 0;
            maxX = 400;
            maxY = 300;
        }

        const padding = 50;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;

        tempCanvas.width = width;
        tempCanvas.height = height;

        // White background
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, width, height);

        // Translate to fit content
        tempCtx.translate(-minX + padding, -minY + padding);

        // Draw connections
        const originalCtx = this.ctx;
        this.ctx = tempCtx;

        this.connections.forEach(connection => {
            if (this.elements.includes(connection.from) && this.elements.includes(connection.to)) {
                this.drawConnection(connection);
            }
        });

        // Draw elements
        this.elements.forEach(el => this.drawElement(el));
        this.ctx = originalCtx;

        // Download
        const link = document.createElement('a');
        link.download = 'mindmap.png';
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
    }

    // Auth Setup
    setupAuth() {
        const signInBtn = document.getElementById('signInBtn');
        const userStatus = document.getElementById('userStatus');

        signInBtn.addEventListener('click', async () => {
            if (FirebaseService.getCurrentUser()) {
                await FirebaseService.signOut();
            } else {
                try {
                    await FirebaseService.signInWithGoogle();
                } catch (error) {
                    console.error('Sign in error:', error);
                    if (error.code !== 'auth/popup-closed-by-user') {
                        alert('Failed to sign in: ' + error.message);
                    }
                }
            }
        });

        FirebaseService.onAuthStateChanged((user) => {
            if (user) {
                userStatus.textContent = user.email;
                signInBtn.textContent = 'Sign Out';
            } else {
                userStatus.textContent = 'Not signed in';
                signInBtn.textContent = 'Sign In';
            }
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.mindmapApp = new MindmapApp();
});

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
        this.currentMindmapName = null; // Track currently loaded mindmap name
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

        // Connection editing
        this.selectedConnection = null;
        this.isDraggingControlPoint = false;
        this.draggingControlPointIndex = -1;
        this.isDraggingMiddleSegment = false;
        this.dragStartPos = null;
        this.dragStartControlPoints = null;

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
        this.fontFamily = 'Arial';

        // Available font families
        this.availableFonts = [
            'Arial',
            'Helvetica',
            'Roboto',
            'Century Gothic',
            'Calibri',
            'Georgia',
            'Times New Roman',
            'Verdana',
            'Trebuchet MS',
            'Comic Sans MS'
        ];

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

        // Line snapping settings
        this.lineSnapAngle = 8; // Snap to horizontal/vertical within 8 degrees

        // Alignment snapping settings
        this.snapThreshold = 8; // Pixels within which to snap
        this.alignmentGuides = []; // Active alignment guides to draw

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
        this.setupTutorial();
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
        this.dpr = window.devicePixelRatio || 1;
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = document.getElementById('canvasContainer');
        const rect = container.getBoundingClientRect();
        
        // Set display size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Set actual size in memory (scaled for retina)
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        
        // Store logical dimensions
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        
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

        // Middle mouse for panning
        if (e.button === 1) {
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

        // Check if clicking on a connection control point or middle segment
        if (this.selectedConnection) {
            const controlPointIndex = this.getControlPointAtPosition(pos, this.selectedConnection);
            if (controlPointIndex >= 0) {
                this.isDraggingControlPoint = true;
                this.draggingControlPointIndex = controlPointIndex;
                this.dragStartPos = { x: pos.x, y: pos.y };
                return;
            }
            
            // Check if clicking on the middle segment (for dragging both points)
            const middleSegmentHit = this.isOnMiddleSegment(pos, this.selectedConnection);
            if (middleSegmentHit) {
                this.isDraggingMiddleSegment = true;
                this.dragStartPos = { x: pos.x, y: pos.y };
                // Initialize control points if not exist
                if (!this.selectedConnection.controlPoints) {
                    const path = this.getOrthogonalPath(this.selectedConnection.from, this.selectedConnection.to);
                    this.selectedConnection.controlPoints = [
                        { x: path[1].x, y: path[1].y },
                        { x: path[2].x, y: path[2].y }
                    ];
                }
                this.dragStartControlPoints = [
                    { ...this.selectedConnection.controlPoints[0] },
                    { ...this.selectedConnection.controlPoints[1] }
                ];
                return;
            }
        }

        // Check if clicking on a connection line
        const clickedConnection = this.getConnectionAtPosition(pos);
        if (clickedConnection) {
            this.selectedConnection = clickedConnection;
            this.selectedElements = [];
            this.updatePropertyPanel();
            this.render();
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
            // Clear connection selection when clicking on element
            this.selectedConnection = null;
            
            if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd+Click: Toggle selection
                const idx = this.selectedElements.indexOf(clickedElement);
                if (idx > -1) {
                    this.selectedElements.splice(idx, 1);
                } else {
                    this.selectedElements.push(clickedElement);
                }
            } else if (e.shiftKey) {
                // Shift+Click: Add to selection (without toggle)
                if (!this.selectedElements.includes(clickedElement)) {
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
            // Clicked on empty canvas
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                this.selectedElements = [];
                this.selectedConnection = null;
            }
            // Start panning on blank canvas
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
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

        // Text boxes are smaller and transparent by default
        const isTextBox = this.currentTool === 'text';
        const width = isTextBox ? 150 : this.defaultWidth;
        const height = isTextBox ? 40 : this.defaultHeight;

        const element = this.createElement(
            this.currentTool,
            pos.x - width / 2,
            pos.y - height / 2,
            pos.x + width / 2,
            pos.y + height / 2
        );

        if (isTextBox) {
            // Text boxes are transparent with no border by default
            element.fillColor = 'transparent';
            element.strokeColor = 'transparent';
            element.strokeWidth = 0;
            element.fontSize = 16;
        } else {
            element.fillColor = fillColor;
            element.strokeColor = strokeColor;
        }

        this.elements.push(element);
        this.selectedElements = [element];
        this.saveState();
        this.render();
        this.updatePropertyPanel();

        // Switch back to select tool after placing
        this.setTool('select');
        
        // Immediately start editing text for text boxes
        if (isTextBox) {
            this.editElementText(element);
        }
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

        // Handle middle segment dragging (moves both control points while maintaining right angles)
        if (this.isDraggingMiddleSegment && this.selectedConnection && this.dragStartControlPoints) {
            const dx = pos.x - this.dragStartPos.x;
            const dy = pos.y - this.dragStartPos.y;
            
            // Determine if this is a horizontal or vertical middle segment
            const cp0 = this.dragStartControlPoints[0];
            const cp1 = this.dragStartControlPoints[1];
            
            if (Math.abs(cp0.x - cp1.x) < 1) {
                // Vertical middle segment - move both points horizontally
                this.selectedConnection.controlPoints = [
                    { x: cp0.x + dx, y: cp0.y },
                    { x: cp1.x + dx, y: cp1.y }
                ];
            } else {
                // Horizontal middle segment - move both points vertically
                this.selectedConnection.controlPoints = [
                    { x: cp0.x, y: cp0.y + dy },
                    { x: cp1.x, y: cp1.y + dy }
                ];
            }
            
            this.render();
            return;
        }

        // Handle control point dragging for connections
        if (this.isDraggingControlPoint && this.selectedConnection) {
            // Initialize control points if not exist
            if (!this.selectedConnection.controlPoints) {
                const path = this.getOrthogonalPath(this.selectedConnection.from, this.selectedConnection.to);
                this.selectedConnection.controlPoints = [
                    { x: path[1].x, y: path[1].y },
                    { x: path[2].x, y: path[2].y }
                ];
            }
            
            // Move both control points together to maintain right angles
            const dx = pos.x - this.dragStartPos.x;
            const dy = pos.y - this.dragStartPos.y;
            
            // Get the original path to determine orientation
            const path = this.selectedConnection._path;
            if (path && path.length >= 4) {
                // Check if dragging point is on a horizontal or vertical segment
                if (this.draggingControlPointIndex === 0) {
                    // First control point - affects first bend
                    // Keep it aligned with the line from start
                    if (Math.abs(path[0].y - path[1].y) < 1) {
                        // Horizontal segment from start - only allow vertical movement
                        this.selectedConnection.controlPoints[0] = { 
                            x: this.selectedConnection.controlPoints[0].x, 
                            y: pos.y 
                        };
                        this.selectedConnection.controlPoints[1] = { 
                            x: this.selectedConnection.controlPoints[1].x, 
                            y: pos.y 
                        };
                    } else {
                        // Vertical segment from start - only allow horizontal movement
                        this.selectedConnection.controlPoints[0] = { 
                            x: pos.x, 
                            y: this.selectedConnection.controlPoints[0].y 
                        };
                        this.selectedConnection.controlPoints[1] = { 
                            x: pos.x, 
                            y: this.selectedConnection.controlPoints[1].y 
                        };
                    }
                } else {
                    // Second control point - affects second bend
                    if (Math.abs(path[3].y - path[2].y) < 1) {
                        // Horizontal segment to end - only allow vertical movement
                        this.selectedConnection.controlPoints[0] = { 
                            x: this.selectedConnection.controlPoints[0].x, 
                            y: pos.y 
                        };
                        this.selectedConnection.controlPoints[1] = { 
                            x: this.selectedConnection.controlPoints[1].x, 
                            y: pos.y 
                        };
                    } else {
                        // Vertical segment to end - only allow horizontal movement
                        this.selectedConnection.controlPoints[0] = { 
                            x: pos.x, 
                            y: this.selectedConnection.controlPoints[0].y 
                        };
                        this.selectedConnection.controlPoints[1] = { 
                            x: pos.x, 
                            y: this.selectedConnection.controlPoints[1].y 
                        };
                    }
                }
            }
            
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
            this.handleResize(pos, e.shiftKey);
            this.render();
            return;
        }

        if (this.isDragging) {
            let dx = pos.x - this.dragOffset.x;
            let dy = pos.y - this.dragOffset.y;

            // Calculate alignment snapping
            const draggedElements = this.dragStartPositions.map(p => p.element);
            const snapped = this.calculateAlignmentSnapping(draggedElements, dx, dy);
            dx = snapped.dx;
            dy = snapped.dy;

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

        // End control point or middle segment dragging
        if (this.isDraggingControlPoint || this.isDraggingMiddleSegment) {
            this.isDraggingControlPoint = false;
            this.isDraggingMiddleSegment = false;
            this.draggingControlPointIndex = -1;
            this.dragStartPos = null;
            this.dragStartControlPoints = null;
            this.saveState();
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
            this.alignmentGuides = []; // Clear alignment guides
            this.saveState();
            this.render(); // Re-render to remove guides
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
            // Create transparent text element on double click
            const textElement = this.createElement('text', pos.x - 75, pos.y - 20, pos.x + 75, pos.y + 20);
            textElement.fillColor = 'transparent';
            textElement.strokeColor = 'transparent';
            textElement.strokeWidth = 0;
            textElement.fontSize = 16;
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
    getOrthogonalPath(fromElement, toElement, connection = null) {
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

            // Use custom control points if they exist, otherwise calculate default
            if (connection && connection.controlPoints && connection.controlPoints.length === 2) {
                path = [
                    startPoint,
                    connection.controlPoints[0],
                    connection.controlPoints[1],
                    endPoint
                ];
            } else {
                // Create Z-path (horizontal -> vertical -> horizontal)
                const midX = (startPoint.x + endPoint.x) / 2;
                path = [
                    startPoint,
                    { x: midX, y: startPoint.y },
                    { x: midX, y: endPoint.y },
                    endPoint
                ];
            }
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

            // Use custom control points if they exist, otherwise calculate default
            if (connection && connection.controlPoints && connection.controlPoints.length === 2) {
                path = [
                    startPoint,
                    connection.controlPoints[0],
                    connection.controlPoints[1],
                    endPoint
                ];
            } else {
                // Create Z-path (vertical -> horizontal -> vertical)
                const midY = (startPoint.y + endPoint.y) / 2;
                path = [
                    startPoint,
                    { x: startPoint.x, y: midY },
                    { x: endPoint.x, y: midY },
                    endPoint
                ];
            }
        }

        return path;
    }

    drawConnection(connection, showControlPoints = false) {
        const path = this.getOrthogonalPath(connection.from, connection.to, connection);

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

        // Draw control points (yellow dots) at the middle points
        if (showControlPoints && path.length >= 4) {
            // Control point 1 (second point in path)
            this.ctx.fillStyle = '#FFD700';
            this.ctx.strokeStyle = '#B8860B';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.arc(path[1].x, path[1].y, 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Control point 2 (third point in path)
            this.ctx.beginPath();
            this.ctx.arc(path[2].x, path[2].y, 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }

        this.ctx.restore();
        
        // Store path for hit testing
        connection._path = path;
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

    // Check if position is on a control point of a connection
    getControlPointAtPosition(pos, connection) {
        if (!connection._path || connection._path.length < 4) return -1;
        
        const path = connection._path;
        // Control points are at index 1 and 2 in the path
        for (let i = 1; i <= 2; i++) {
            const point = path[i];
            const dist = Math.sqrt(Math.pow(pos.x - point.x, 2) + Math.pow(pos.y - point.y, 2));
            if (dist < 10) {
                return i - 1; // Return 0 or 1 for control point index
            }
        }
        return -1;
    }

    // Check if position is on the middle segment of a connection
    isOnMiddleSegment(pos, connection) {
        if (!connection._path || connection._path.length < 4) return false;
        
        const path = connection._path;
        // Middle segment is between path[1] and path[2]
        const dist = this.distanceToLineSegment(pos, path[1], path[2]);
        return dist < 8;
    }

    // Check if position is on a connection line
    getConnectionAtPosition(pos) {
        for (let connection of this.connections) {
            if (!connection._path || connection._path.length < 2) continue;
            
            const path = connection._path;
            // Check each segment of the path
            for (let i = 0; i < path.length - 1; i++) {
                const p1 = path[i];
                const p2 = path[i + 1];
                
                // Calculate distance from point to line segment
                const dist = this.distanceToLineSegment(pos, p1, p2);
                if (dist < 8) {
                    return connection;
                }
            }
        }
        return null;
    }

    // Calculate distance from point to line segment
    distanceToLineSegment(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
            return Math.sqrt(Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2));
        }
        
        let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));
        
        const nearestX = lineStart.x + t * dx;
        const nearestY = lineStart.y + t * dy;
        
        return Math.sqrt(Math.pow(point.x - nearestX, 2) + Math.pow(point.y - nearestY, 2));
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

            // Arrow keys for micro-adjustment of selected elements
            if (this.selectedElements.length > 0) {
                const moveAmount = e.shiftKey ? 10 : 2; // Shift = larger steps
                let moved = false;
                
                switch (e.key) {
                    case 'ArrowUp':
                        this.selectedElements.forEach(el => el.y -= moveAmount);
                        moved = true;
                        break;
                    case 'ArrowDown':
                        this.selectedElements.forEach(el => el.y += moveAmount);
                        moved = true;
                        break;
                    case 'ArrowLeft':
                        this.selectedElements.forEach(el => el.x -= moveAmount);
                        moved = true;
                        break;
                    case 'ArrowRight':
                        this.selectedElements.forEach(el => el.x += moveAmount);
                        moved = true;
                        break;
                }
                
                if (moved) {
                    e.preventDefault();
                    this.saveState();
                    this.render();
                    return;
                }
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

        // Check if we have a selected shape to paste into
        const selectedShape = this.selectedElements.length === 1 ? this.selectedElements[0] : null;
        const isShape = selectedShape && ['rect', 'circle', 'diamond', 'triangle'].includes(selectedShape.type);

        for (let item of items) {
            // Handle image paste
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                
                if (isShape) {
                    // Paste image into selected shape
                    this.addImageToShape(selectedShape, file);
                } else {
                    this.addImageFromFile(file);
                }
                return;
            }
            
            // Handle text paste into shape
            if (item.type === 'text/plain' && isShape) {
                e.preventDefault();
                item.getAsString((text) => {
                    if (selectedShape.text) {
                        selectedShape.text += '\n' + text;
                    } else {
                        selectedShape.text = text;
                    }
                    this.saveState();
                    this.render();
                    this.updatePropertyPanel();
                });
                return;
            }
        }
    }

    // Add image to a shape
    addImageToShape(shape, file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Store image in shape
                shape.embeddedImage = {
                    data: event.target.result,
                    image: img,
                    originalWidth: img.width,
                    originalHeight: img.height,
                    position: 'bottom' // 'left', 'right', 'bottom', 'top'
                };
                
                // Auto-resize shape to fit image if needed
                const padding = 20;
                const minWidth = Math.max(shape.width, img.width * 0.5 + padding * 2);
                const minHeight = Math.max(shape.height, img.height * 0.3 + padding * 2 + 40); // +40 for text
                
                if (minWidth > shape.width) shape.width = minWidth;
                if (minHeight > shape.height) shape.height = minHeight;
                
                this.saveState();
                this.render();
                this.updatePropertyPanel();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
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
            fontFamily: this.fontFamily,
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
            // Apply line snapping for straight lines
            const snapped = this.snapLineEndpoint(
                this.tempElement.x, this.tempElement.y,
                pos.x, pos.y
            );
            this.tempElement.x2 = snapped.x;
            this.tempElement.y2 = snapped.y;
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

    // Snap line endpoint to horizontal or vertical if within threshold angle
    snapLineEndpoint(startX, startY, endX, endY) {
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
        const snapThreshold = this.lineSnapAngle;

        // Snap to horizontal (0 or 180 degrees)
        if (angle <= snapThreshold || angle >= 180 - snapThreshold) {
            return { x: endX, y: startY };
        }
        // Snap to vertical (90 degrees)
        if (Math.abs(angle - 90) <= snapThreshold) {
            return { x: startX, y: endY };
        }
        // No snap
        return { x: endX, y: endY };
    }

    // Calculate alignment guides and snap positions for dragged elements
    calculateAlignmentSnapping(draggedElements, dx, dy) {
        this.alignmentGuides = [];
        let snapDx = dx;
        let snapDy = dy;

        // Get the bounds of all selected elements combined
        const selectedBounds = this.getCombinedBounds(draggedElements);
        if (!selectedBounds) return { dx, dy };

        // PRIORITY 1: Check for connection line snapping (horizontal/vertical alignment)
        // This overrides general element alignment
        const connectionSnap = this.calculateConnectionLineSnapping(draggedElements, dx, dy);
        if (connectionSnap.snappedX || connectionSnap.snappedY) {
            if (connectionSnap.snappedX) {
                snapDx = connectionSnap.dx;
                this.alignmentGuides.push(...connectionSnap.guidesX);
            }
            if (connectionSnap.snappedY) {
                snapDy = connectionSnap.dy;
                this.alignmentGuides.push(...connectionSnap.guidesY);
            }
            // If we have connection snaps, use them and skip general alignment for that axis
            if (connectionSnap.snappedX && connectionSnap.snappedY) {
                return { dx: snapDx, dy: snapDy };
            }
        }

        // PRIORITY 2: General element alignment snapping (for axes not snapped by connections)
        // Calculate where the selected elements would be after the move
        const projectedBounds = {
            left: selectedBounds.left + (connectionSnap.snappedX ? snapDx : dx),
            right: selectedBounds.right + (connectionSnap.snappedX ? snapDx : dx),
            top: selectedBounds.top + (connectionSnap.snappedY ? snapDy : dy),
            bottom: selectedBounds.bottom + (connectionSnap.snappedY ? snapDy : dy),
            centerX: selectedBounds.centerX + (connectionSnap.snappedX ? snapDx : dx),
            centerY: selectedBounds.centerY + (connectionSnap.snappedY ? snapDy : dy)
        };

        // Get all non-selected elements to compare against
        const otherElements = this.elements.filter(el =>
            !draggedElements.includes(el) &&
            el.type !== 'arrow' && el.type !== 'line'
        );

        // Collect all snap points from other elements
        const snapPointsX = []; // { value, type, element }
        const snapPointsY = [];

        otherElements.forEach(el => {
            const bounds = this.getElementBounds(el);
            const left = bounds.x;
            const right = bounds.x + bounds.width;
            const top = bounds.y;
            const bottom = bounds.y + bounds.height;
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;

            snapPointsX.push({ value: left, type: 'left', element: el });
            snapPointsX.push({ value: right, type: 'right', element: el });
            snapPointsX.push({ value: centerX, type: 'center', element: el });

            snapPointsY.push({ value: top, type: 'top', element: el });
            snapPointsY.push({ value: bottom, type: 'bottom', element: el });
            snapPointsY.push({ value: centerY, type: 'center', element: el });
        });

        // Check horizontal alignments (X axis) - only if not already snapped by connection
        if (!connectionSnap.snappedX) {
            const selectedXPoints = [
                { value: projectedBounds.left, type: 'left' },
                { value: projectedBounds.right, type: 'right' },
                { value: projectedBounds.centerX, type: 'center' }
            ];

            let bestSnapX = null;
            let bestSnapXDist = this.snapThreshold;

            selectedXPoints.forEach(selPoint => {
                snapPointsX.forEach(snapPoint => {
                    const dist = Math.abs(selPoint.value - snapPoint.value);
                    if (dist < bestSnapXDist) {
                        bestSnapXDist = dist;
                        bestSnapX = {
                            selectedType: selPoint.type,
                            snapValue: snapPoint.value,
                            snapType: snapPoint.type,
                            element: snapPoint.element
                        };
                    }
                });
            });

            if (bestSnapX) {
                const currentValue = selectedBounds[bestSnapX.selectedType === 'center' ? 'centerX' : bestSnapX.selectedType];
                const adjustment = bestSnapX.snapValue - (currentValue + dx);
                snapDx = dx + adjustment;

                // Create vertical guide line
                const snapElBounds = this.getElementBounds(bestSnapX.element);
                this.alignmentGuides.push({
                    type: 'vertical',
                    x: bestSnapX.snapValue,
                    y1: Math.min(selectedBounds.top + snapDy, snapElBounds.y) - 20,
                    y2: Math.max(selectedBounds.bottom + snapDy, snapElBounds.y + snapElBounds.height) + 20
                });
            }
        }

        // Check vertical alignments (Y axis) - only if not already snapped by connection
        if (!connectionSnap.snappedY) {
            const selectedYPoints = [
                { value: projectedBounds.top, type: 'top' },
                { value: projectedBounds.bottom, type: 'bottom' },
                { value: projectedBounds.centerY, type: 'center' }
            ];

            let bestSnapY = null;
            let bestSnapYDist = this.snapThreshold;

            selectedYPoints.forEach(selPoint => {
                snapPointsY.forEach(snapPoint => {
                    const dist = Math.abs(selPoint.value - snapPoint.value);
                    if (dist < bestSnapYDist) {
                        bestSnapYDist = dist;
                        bestSnapY = {
                            selectedType: selPoint.type,
                            snapValue: snapPoint.value,
                            snapType: snapPoint.type,
                            element: snapPoint.element
                        };
                    }
                });
            });

            if (bestSnapY) {
                const currentValue = selectedBounds[bestSnapY.selectedType === 'center' ? 'centerY' : bestSnapY.selectedType];
                const adjustment = bestSnapY.snapValue - (currentValue + dy);
                snapDy = dy + adjustment;

                // Create horizontal guide line
                const snapElBounds = this.getElementBounds(bestSnapY.element);
                this.alignmentGuides.push({
                    type: 'horizontal',
                    y: bestSnapY.snapValue,
                    x1: Math.min(selectedBounds.left + snapDx, snapElBounds.x) - 20,
                    x2: Math.max(selectedBounds.right + snapDx, snapElBounds.x + snapElBounds.width) + 20
                });
            }
        }

        return { dx: snapDx, dy: snapDy };
    }

    // Calculate snapping to make connection lines horizontal or vertical (PRIORITY OVER ELEMENT ALIGNMENT)
    calculateConnectionLineSnapping(draggedElements, dx, dy) {
        const result = {
            dx: dx,
            dy: dy,
            snappedX: false,
            snappedY: false,
            guidesX: [],
            guidesY: []
        };

        // Find all connections involving the dragged elements
        const relevantConnections = this.connections.filter(conn =>
            (draggedElements.includes(conn.from) && !draggedElements.includes(conn.to)) ||
            (draggedElements.includes(conn.to) && !draggedElements.includes(conn.from))
        );

        if (relevantConnections.length === 0) return result;

        let bestHorizontalSnap = null;
        let bestHorizontalDist = this.snapThreshold * 2; // Larger threshold for line snapping priority
        let bestVerticalSnap = null;
        let bestVerticalDist = this.snapThreshold * 2;

        relevantConnections.forEach(conn => {
            const movingElement = draggedElements.includes(conn.from) ? conn.from : conn.to;
            const staticElement = draggedElements.includes(conn.from) ? conn.to : conn.from;

            const movingBounds = this.getElementBounds(movingElement);
            const staticBounds = this.getElementBounds(staticElement);

            // Calculate projected center of moving element
            const movingCenterX = movingBounds.x + movingBounds.width / 2 + dx;
            const movingCenterY = movingBounds.y + movingBounds.height / 2 + dy;

            // Static element center
            const staticCenterX = staticBounds.x + staticBounds.width / 2;
            const staticCenterY = staticBounds.y + staticBounds.height / 2;

            // Check if we can snap to make a horizontal connection line (same Y center)
            const yDiff = Math.abs(movingCenterY - staticCenterY);
            if (yDiff < bestHorizontalDist) {
                bestHorizontalDist = yDiff;
                bestHorizontalSnap = {
                    targetY: staticCenterY,
                    currentY: movingBounds.y + movingBounds.height / 2,
                    movingElement,
                    staticElement,
                    movingBounds,
                    staticBounds
                };
            }

            // Check if we can snap to make a vertical connection line (same X center)
            const xDiff = Math.abs(movingCenterX - staticCenterX);
            if (xDiff < bestVerticalDist) {
                bestVerticalDist = xDiff;
                bestVerticalSnap = {
                    targetX: staticCenterX,
                    currentX: movingBounds.x + movingBounds.width / 2,
                    movingElement,
                    staticElement,
                    movingBounds,
                    staticBounds
                };
            }
        });

        // Apply horizontal line snap (align Y centers for horizontal connection)
        if (bestHorizontalSnap) {
            const adjustment = bestHorizontalSnap.targetY - (bestHorizontalSnap.currentY + dy);
            result.dy = dy + adjustment;
            result.snappedY = true;

            // Create guide line for horizontal connection alignment (green for connection guides)
            result.guidesY.push({
                type: 'horizontal',
                y: bestHorizontalSnap.targetY,
                x1: Math.min(bestHorizontalSnap.movingBounds.x + result.dx, bestHorizontalSnap.staticBounds.x) - 30,
                x2: Math.max(bestHorizontalSnap.movingBounds.x + bestHorizontalSnap.movingBounds.width + result.dx,
                           bestHorizontalSnap.staticBounds.x + bestHorizontalSnap.staticBounds.width) + 30,
                isConnectionGuide: true
            });
        }

        // Apply vertical line snap (align X centers for vertical connection)
        if (bestVerticalSnap) {
            const adjustment = bestVerticalSnap.targetX - (bestVerticalSnap.currentX + dx);
            result.dx = dx + adjustment;
            result.snappedX = true;

            // Create guide line for vertical connection alignment (green for connection guides)
            result.guidesX.push({
                type: 'vertical',
                x: bestVerticalSnap.targetX,
                y1: Math.min(bestVerticalSnap.movingBounds.y + result.dy, bestVerticalSnap.staticBounds.y) - 30,
                y2: Math.max(bestVerticalSnap.movingBounds.y + bestVerticalSnap.movingBounds.height + result.dy,
                           bestVerticalSnap.staticBounds.y + bestVerticalSnap.staticBounds.height) + 30,
                isConnectionGuide: true
            });
        }

        return result;
    }

    // Get combined bounds of multiple elements
    getCombinedBounds(elements) {
        if (elements.length === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        elements.forEach(el => {
            const bounds = this.getElementBounds(el);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        return {
            left: minX,
            top: minY,
            right: maxX,
            bottom: maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // Draw alignment guide lines
    drawAlignmentGuides() {
        if (this.alignmentGuides.length === 0) return;

        this.ctx.save();
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);

        this.alignmentGuides.forEach(guide => {
            // Use green for connection guides (priority snapping), red for regular alignment
            this.ctx.strokeStyle = guide.isConnectionGuide ? '#00b894' : '#ff6b6b';
            this.ctx.lineWidth = guide.isConnectionGuide ? 2 : 1;

            this.ctx.beginPath();
            if (guide.type === 'vertical') {
                this.ctx.moveTo(guide.x, guide.y1);
                this.ctx.lineTo(guide.x, guide.y2);
            } else {
                this.ctx.moveTo(guide.x1, guide.y);
                this.ctx.lineTo(guide.x2, guide.y);
            }
            this.ctx.stroke();
        });

        this.ctx.restore();
    }

    // Rendering
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply devicePixelRatio scaling for retina displays
        this.ctx.save();
        this.ctx.scale(this.dpr, this.dpr);

        // Apply pan and zoom
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoom, this.zoom);

        // Draw all connections first (behind shapes)
        this.connections.forEach(connection => {
            // Check if both elements still exist
            if (this.elements.includes(connection.from) && this.elements.includes(connection.to)) {
                const isSelected = connection === this.selectedConnection;
                this.drawConnection(connection, isSelected);
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

        // Draw alignment guides (when dragging)
        this.drawAlignmentGuides();

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
    wrapText(text, maxWidth, fontSize, ctx, fontFamily = 'Arial') {
        if (!text) return [];

        const font = `${fontSize}px "${fontFamily}", -apple-system, BlinkMacSystemFont, sans-serif`;
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
    calculateOptimalFontSize(text, maxWidth, maxHeight, baseFontSize, ctx, padding = 10, fontFamily = 'Arial') {
        if (!text) return { fontSize: baseFontSize, lines: [] };

        const minFontSize = 8;
        const lineHeightRatio = 1.3;
        let fontSize = baseFontSize;

        // Available space after padding
        const availableWidth = maxWidth - padding * 2;
        const availableHeight = maxHeight - padding * 2;

        while (fontSize >= minFontSize) {
            const lines = this.wrapText(text, availableWidth, fontSize, ctx, fontFamily);
            const totalTextHeight = lines.length * fontSize * lineHeightRatio;

            if (totalTextHeight <= availableHeight) {
                return { fontSize, lines };
            }

            fontSize -= 1;
        }

        // Return minimum font size even if it doesn't fit perfectly
        const lines = this.wrapText(text, availableWidth, minFontSize, ctx, fontFamily);
        return { fontSize: minFontSize, lines };
    }

    // Render text with crisp quality at any zoom level
    // This renders text outside the zoom transform for pixel-perfect clarity
    renderCrispText(lines, centerX, centerY, fontSize, maxHeight, padding = 10, fontFamily = 'Arial') {
        if (lines.length === 0) return;

        // Get current DPR (default to 1 for export context)
        const dpr = this.dpr || 1;

        // Calculate screen-space coordinates with DPR
        const screenX = (centerX * this.zoom + this.panOffset.x) * dpr;
        const screenY = (centerY * this.zoom + this.panOffset.y) * dpr;
        const screenFontSize = fontSize * this.zoom * dpr;
        const lineHeight = fontSize * 1.3 * this.zoom * dpr;

        // Save current state and reset transform for crisp text rendering
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity matrix

        // Set text properties with scaled font size
        this.ctx.fillStyle = '#333333';
        this.ctx.font = `600 ${screenFontSize}px "${fontFamily}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
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
        const { x, y, width, height, text, fontSize, fontFamily } = element;

        // Draw background if has fill color (not transparent)
        if (element.fillColor && element.fillColor !== 'transparent') {
            this.ctx.fillStyle = element.fillColor;
            this.ctx.fillRect(x, y, width, height);
        }

        // Draw border if has stroke color (not transparent)
        if (element.strokeColor && element.strokeColor !== 'transparent' && element.strokeWidth > 0) {
            this.ctx.strokeStyle = element.strokeColor;
            this.ctx.lineWidth = element.strokeWidth || 1;
            this.ctx.strokeRect(x, y, width, height);
        }

        // Draw text with crisp rendering, auto-wrapping, and auto-sizing
        if (text) {
            const baseFontSize = fontSize || 16;
            const padding = 4;
            const font = fontFamily || 'Arial';

            // Calculate optimal font size with text wrapping
            const { fontSize: optimalFontSize, lines } = this.calculateOptimalFontSize(
                text, width, height, baseFontSize, this.ctx, padding, font
            );

            // Render crisp text at center of element
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            this.renderCrispText(lines, centerX, centerY, optimalFontSize, height, padding, font);
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
        const width = element.width || 0;
        const height = element.height || 0;
        const baseFontSize = element.fontSize || 14;
        const fontFamily = element.fontFamily || 'Arial';

        // Calculate padding based on shape type
        let padding = 10;
        if (element.type === 'diamond') {
            padding = Math.min(width, height) * 0.25;
        } else if (element.type === 'triangle') {
            padding = Math.min(width, height) * 0.2;
        } else if (element.type === 'circle') {
            padding = Math.min(width, height) * 0.15;
        }

        // Handle embedded image
        if (element.embeddedImage && element.embeddedImage.image) {
            this.drawEmbeddedImage(element, padding);
        }

        // Draw text if present
        if (!element.text) return;

        // Calculate optimal font size with text wrapping
        const { fontSize: optimalFontSize, lines } = this.calculateOptimalFontSize(
            element.text, width, height, baseFontSize, this.ctx, padding, fontFamily
        );

        // Adjust text position based on image position
        let centerX = element.x + width / 2;
        let centerY = element.y + height / 2;

        if (element.embeddedImage) {
            const imgPos = element.embeddedImage.position || 'bottom';
            const imgHeight = this.getEmbeddedImageDimensions(element, padding).height;

            if (imgPos === 'bottom') {
                centerY = element.y + (height - imgHeight - padding) / 2 + padding / 2;
            } else if (imgPos === 'top') {
                centerY = element.y + height - (height - imgHeight - padding) / 2 - padding / 2;
            } else if (imgPos === 'left' || imgPos === 'right') {
                // Text takes half the width
                const imgWidth = this.getEmbeddedImageDimensions(element, padding).width;
                if (imgPos === 'left') {
                    centerX = element.x + imgWidth + (width - imgWidth) / 2;
                } else {
                    centerX = element.x + (width - imgWidth) / 2;
                }
            }
        }

        this.renderCrispText(lines, centerX, centerY, optimalFontSize, height, padding, fontFamily);
    }

    // Get embedded image dimensions scaled to fit shape
    getEmbeddedImageDimensions(element, padding) {
        const img = element.embeddedImage;
        if (!img || !img.image) return { width: 0, height: 0 };

        const pos = img.position || 'bottom';
        const availableWidth = element.width - padding * 2;
        const availableHeight = element.height - padding * 2;
        
        // Use custom scale if set, otherwise calculate to fit
        const customScale = img.scale || 1;
        
        let maxWidth, maxHeight;
        
        if (pos === 'left' || pos === 'right') {
            maxWidth = availableWidth * 0.5;  // Increased from 0.4
            maxHeight = availableHeight * 0.9; // Increased from 0.8
        } else {
            maxWidth = availableWidth * 0.95;  // Increased from 0.8
            maxHeight = availableHeight * 0.7; // Increased from 0.5
        }

        const fitRatio = Math.min(maxWidth / img.originalWidth, maxHeight / img.originalHeight, 1);
        const ratio = fitRatio * customScale;
        
        return {
            width: img.originalWidth * ratio,
            height: img.originalHeight * ratio
        };
    }

    // Draw embedded image inside shape
    drawEmbeddedImage(element, padding) {
        const img = element.embeddedImage;
        if (!img || !img.image) return;

        const dims = this.getEmbeddedImageDimensions(element, padding);
        const pos = img.position || 'bottom';
        
        let imgX, imgY;
        
        if (pos === 'bottom') {
            imgX = element.x + (element.width - dims.width) / 2;
            imgY = element.y + element.height - dims.height - padding;
        } else if (pos === 'top') {
            imgX = element.x + (element.width - dims.width) / 2;
            imgY = element.y + padding;
        } else if (pos === 'left') {
            imgX = element.x + padding;
            imgY = element.y + (element.height - dims.height) / 2;
        } else if (pos === 'right') {
            imgX = element.x + element.width - dims.width - padding;
            imgY = element.y + (element.height - dims.height) / 2;
        }

        // Clip to shape bounds
        this.ctx.save();
        this.ctx.beginPath();
        if (element.type === 'rect') {
            const radius = Math.min(8, element.width / 4, element.height / 4);
            this.ctx.roundRect(element.x, element.y, element.width, element.height, radius);
        } else if (element.type === 'circle') {
            this.ctx.ellipse(
                element.x + element.width / 2,
                element.y + element.height / 2,
                element.width / 2,
                element.height / 2,
                0, 0, Math.PI * 2
            );
        } else {
            this.ctx.rect(element.x, element.y, element.width, element.height);
        }
        this.ctx.clip();
        
        this.ctx.drawImage(img.image, imgX, imgY, dims.width, dims.height);
        this.ctx.restore();
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

    handleResize(pos, shiftKey = false) {
        const { element, handle } = this.resizeHandle;

        if (element.type === 'arrow' || element.type === 'line') {
            if (handle.type === 'start') {
                // Snap start point relative to end point
                const snapped = this.snapLineEndpoint(element.x2, element.y2, pos.x, pos.y);
                element.x = snapped.x;
                element.y = snapped.y;
            } else {
                // Snap end point relative to start point
                const snapped = this.snapLineEndpoint(element.x, element.y, pos.x, pos.y);
                element.x2 = snapped.x;
                element.y2 = snapped.y;
            }
            return;
        }

        const bounds = this.getElementBounds(element);
        const originalRatio = element.width / element.height;
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

        // Shift key: maintain aspect ratio (proportional resize)
        if (shiftKey && ['nw', 'ne', 'se', 'sw'].includes(handle.type)) {
            // Use the larger dimension change to determine scale
            const widthRatio = newWidth / element.width;
            const heightRatio = newHeight / element.height;
            const scale = Math.max(widthRatio, heightRatio);
            
            newWidth = element.width * scale;
            newHeight = element.height * scale;
            
            // Adjust position for corner handles
            if (handle.type === 'nw') {
                newX = bounds.x + bounds.width - newWidth;
                newY = bounds.y + bounds.height - newHeight;
            } else if (handle.type === 'ne') {
                newY = bounds.y + bounds.height - newHeight;
            } else if (handle.type === 'sw') {
                newX = bounds.x + bounds.width - newWidth;
            }
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
        } else if (this.currentTool === 'select') {
            // Hand cursor on blank canvas for panning
            this.canvas.style.cursor = 'grab';
        } else {
            this.canvas.style.cursor = 'crosshair';
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

    // Load image with fallback - try primary source, then fallback URL
    loadImageWithFallback(primarySrc, fallbackUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            const tryLoad = (src, withCors = false) => {
                if (!src) {
                    reject(new Error('No image source'));
                    return;
                }
                
                // Create fresh image for each attempt
                const testImg = new Image();
                
                testImg.onload = () => resolve(testImg);
                testImg.onerror = () => {
                    // If failed with CORS, try without CORS
                    if (withCors && src.includes('firebasestorage.googleapis.com')) {
                        console.log('Retrying without CORS...');
                        tryLoad(src, false);
                        return;
                    }
                    // If primary failed, try fallback
                    if (src === primarySrc && fallbackUrl && fallbackUrl !== primarySrc) {
                        console.log('Primary image failed, trying fallback URL');
                        tryLoad(fallbackUrl, false);
                    } else {
                        reject(new Error('Failed to load image'));
                    }
                };
                
                // Don't set crossOrigin for Firebase Storage URLs - they have signed tokens
                // Also don't set for data URLs (base64)
                if (withCors && src.startsWith('http') && !src.includes('firebasestorage.googleapis.com')) {
                    testImg.crossOrigin = 'anonymous';
                }
                testImg.src = src;
            };
            
            // Try without CORS first for Firebase URLs
            const isFirebase = primarySrc && primarySrc.includes('firebasestorage.googleapis.com');
            tryLoad(primarySrc, !isFirebase);
        });
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
        document.getElementById('submitBtn').addEventListener('click', () => this.showSubmitModal());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCanvas());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportAsPng());

        // Emoji buttons (in properties panel)
        document.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.dataset.emoji;
                this.insertEmoji(emoji);
            });
        });
    }

    // Insert emoji into selected shape's text
    insertEmoji(emoji) {
        if (this.selectedElements.length > 0) {
            // Add emoji to selected element's text
            this.selectedElements.forEach(el => {
                if (el.text !== undefined) {
                    el.text = (el.text || '') + emoji;
                }
            });
            this.saveState();
            this.render();
            this.updatePropertyPanel();
            
            // Update the text area to show the new text
            const elementText = document.getElementById('elementText');
            if (elementText && this.selectedElements.length === 1) {
                elementText.value = this.selectedElements[0].text || '';
            }
        }
    }

    // Loading overlay
    showLoading(text = 'Saving...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = overlay.querySelector('.loading-text');
        loadingText.textContent = text;
        overlay.style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
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

        // Font family selector
        const elementFontFamily = document.getElementById('elementFontFamily');
        elementFontFamily.addEventListener('change', (e) => {
            this.selectedElements.forEach(el => {
                el.fontFamily = e.target.value;
            });
            this.saveState();
            this.render();
        });

        deleteBtn.addEventListener('click', () => {
            this.deleteSelected();
        });

        // Image position buttons
        ['Left', 'Top', 'Bottom', 'Right'].forEach(pos => {
            const btn = document.getElementById(`imgPos${pos}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    if (this.selectedElements.length === 1 && this.selectedElements[0].embeddedImage) {
                        this.selectedElements[0].embeddedImage.position = pos.toLowerCase();
                        document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        this.saveState();
                        this.render();
                    }
                });
            }
        });

        // Remove image button
        const removeImageBtn = document.getElementById('removeImage');
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', () => {
                if (this.selectedElements.length === 1 && this.selectedElements[0].embeddedImage) {
                    delete this.selectedElements[0].embeddedImage;
                    this.saveState();
                    this.render();
                    this.updatePropertyPanel();
                }
            });
        }

        // Image scale slider
        const imgScaleSlider = document.getElementById('imgScale');
        const imgScaleValue = document.getElementById('imgScaleValue');
        if (imgScaleSlider) {
            imgScaleSlider.addEventListener('input', () => {
                if (this.selectedElements.length === 1 && this.selectedElements[0].embeddedImage) {
                    const scale = parseInt(imgScaleSlider.value) / 100;
                    this.selectedElements[0].embeddedImage.scale = scale;
                    imgScaleValue.textContent = imgScaleSlider.value + '%';
                    this.render();
                }
            });
            imgScaleSlider.addEventListener('change', () => {
                this.saveState();
            });
        }
    }

    updatePropertyPanel() {
        const noSelection = document.getElementById('noSelection');
        const elementProperties = document.getElementById('elementProperties');
        const imagePositionGroup = document.getElementById('imagePositionGroup');

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
        document.getElementById('elementFontFamily').value = element.fontFamily || 'Arial';

        // Show/hide image position controls
        if (element.embeddedImage && imagePositionGroup) {
            imagePositionGroup.style.display = 'block';
            const pos = element.embeddedImage.position || 'bottom';
            document.querySelectorAll('.pos-btn').forEach(btn => btn.classList.remove('active'));
            const posBtn = document.getElementById(`imgPos${pos.charAt(0).toUpperCase() + pos.slice(1)}`);
            if (posBtn) posBtn.classList.add('active');
            
            // Set image scale slider
            const scale = element.embeddedImage.scale || 1;
            const imgScaleSlider = document.getElementById('imgScale');
            const imgScaleValue = document.getElementById('imgScaleValue');
            if (imgScaleSlider) {
                imgScaleSlider.value = Math.round(scale * 100);
                imgScaleValue.textContent = Math.round(scale * 100) + '%';
            }
        } else if (imagePositionGroup) {
            imagePositionGroup.style.display = 'none';
        }
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

        // Submit Modal
        document.getElementById('closeSubmitModal').addEventListener('click', () => {
            document.getElementById('submitModal').style.display = 'none';
        });

        document.getElementById('confirmSubmit').addEventListener('click', () => {
            this.submitMindmap();
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

        // Pre-fill with current mindmap name if loaded from a saved map
        const nameInput = document.getElementById('mindmapName');
        if (this.currentMindmapName) {
            nameInput.value = this.currentMindmapName;
        }

        document.getElementById('saveModal').style.display = 'flex';
        nameInput.focus();
    }

    async saveMindmap() {
        const name = document.getElementById('mindmapName').value.trim();
        if (!name) {
            alert('Please enter a name for your mindmap.');
            return;
        }

        document.getElementById('saveModal').style.display = 'none';
        this.showLoading('Saving...');

        try {
            // Process elements - upload images to Storage (NO base64 in Firestore to avoid 1MB limit)
            const processedElements = await Promise.all(this.elements.map(async (el, index) => {
                const processed = { ...el, image: undefined };

                // Handle embedded images
                if (el.embeddedImage && el.embeddedImage.data) {
                    try {
                        const filename = `embedded_${index}_${Date.now()}.png`;
                        const imageUrl = await FirebaseService.uploadImage(
                            this.dataURLtoBlob(el.embeddedImage.data),
                            filename
                        );
                        processed.embeddedImage = {
                            position: el.embeddedImage.position,
                            scale: el.embeddedImage.scale,
                            originalWidth: el.embeddedImage.originalWidth,
                            originalHeight: el.embeddedImage.originalHeight,
                            url: imageUrl,
                            // NO base64 data stored - only URL to avoid Firestore 1MB limit
                            image: undefined
                        };
                    } catch (uploadErr) {
                        console.warn('Failed to upload embedded image:', uploadErr);
                        // Store minimal data without base64
                        processed.embeddedImage = {
                            position: el.embeddedImage.position,
                            scale: el.embeddedImage.scale,
                            originalWidth: el.embeddedImage.originalWidth,
                            originalHeight: el.embeddedImage.originalHeight,
                            image: undefined
                        };
                    }
                } else if (el.embeddedImage) {
                    processed.embeddedImage = {
                        position: el.embeddedImage.position,
                        scale: el.embeddedImage.scale,
                        originalWidth: el.embeddedImage.originalWidth,
                        originalHeight: el.embeddedImage.originalHeight,
                        url: el.embeddedImage.url,
                        image: undefined
                    };
                }

                // Handle standalone images
                if (el.type === 'image' && el.imageData) {
                    try {
                        const filename = `image_${index}_${Date.now()}.png`;
                        const imageUrl = await FirebaseService.uploadImage(
                            this.dataURLtoBlob(el.imageData),
                            filename
                        );
                        processed.imageUrl = imageUrl;
                        // Remove base64 data to avoid Firestore 1MB limit
                        processed.imageData = undefined;
                    } catch (uploadErr) {
                        console.warn('Failed to upload image:', uploadErr);
                        // Remove base64 to avoid size limit - image won't load on reload
                        processed.imageData = undefined;
                    }
                    processed.image = undefined;
                } else if (el.type === 'image') {
                    // Already has URL, just clean up
                    processed.imageData = undefined;
                    processed.image = undefined;
                }

                return processed;
            }));

            const data = {
                elements: processedElements,
                connections: this.connections.map(c => ({
                    fromIndex: this.elements.indexOf(c.from),
                    toIndex: this.elements.indexOf(c.to),
                    strokeColor: c.strokeColor,
                    strokeWidth: c.strokeWidth
                }))
            };

            // Generate and upload thumbnail
            let thumbnailUrl = null;
            try {
                const thumbnailData = this.generateThumbnail();
                if (thumbnailData) {
                    const thumbnailFilename = `thumb_${Date.now()}.png`;
                    thumbnailUrl = await FirebaseService.uploadImage(
                        this.dataURLtoBlob(thumbnailData),
                        thumbnailFilename
                    );
                }
            } catch (thumbErr) {
                console.warn('Failed to generate/upload thumbnail:', thumbErr);
            }

            await FirebaseService.saveMindmap(name, data, thumbnailUrl);
            // Store the name for subsequent saves
            this.currentMindmapName = name;
            this.hideLoading();
            alert('✅ Draft saved successfully!');
        } catch (error) {
            this.hideLoading();
            console.error('Save error:', error);
            alert('Failed to save mindmap: ' + error.message);
        }
    }

    // Submit Modal
    showSubmitModal() {
        if (!FirebaseService.isConfigured()) {
            alert('Firebase is not configured.');
            return;
        }

        if (!FirebaseService.getCurrentUser()) {
            alert('Please sign in to submit your mindmap.');
            return;
        }

        if (this.elements.length === 0) {
            alert('Please create a mindmap before submitting.');
            return;
        }

        document.getElementById('submitModal').style.display = 'flex';
        document.getElementById('submitMindmapName').focus();
    }

    async submitMindmap() {
        const name = document.getElementById('submitMindmapName').value.trim();
        const studentName = document.getElementById('studentName').value.trim();
        
        if (!name) {
            alert('Please enter a title for your mindmap.');
            return;
        }
        if (!studentName) {
            alert('Please enter your name.');
            return;
        }

        try {
            // Process elements - upload embedded images to Storage
            const processedElements = await Promise.all(this.elements.map(async (el, index) => {
                const processed = { ...el, image: undefined };
                
                if (el.embeddedImage && el.embeddedImage.data) {
                    try {
                        const filename = `submit_${index}_${Date.now()}.png`;
                        const imageUrl = await FirebaseService.uploadImage(
                            this.dataURLtoBlob(el.embeddedImage.data),
                            filename
                        );
                        processed.embeddedImage = {
                            ...el.embeddedImage,
                            url: imageUrl,
                            data: undefined,
                            image: undefined
                        };
                    } catch (uploadErr) {
                        console.warn('Failed to upload embedded image:', uploadErr);
                        processed.embeddedImage = {
                            position: el.embeddedImage.position,
                            scale: el.embeddedImage.scale,
                            originalWidth: el.embeddedImage.originalWidth,
                            originalHeight: el.embeddedImage.originalHeight
                        };
                    }
                } else if (el.embeddedImage) {
                    // Image was already loaded from a saved mindmap - preserve URL
                    processed.embeddedImage = {
                        position: el.embeddedImage.position,
                        scale: el.embeddedImage.scale,
                        originalWidth: el.embeddedImage.originalWidth,
                        originalHeight: el.embeddedImage.originalHeight,
                        url: el.embeddedImage.url,
                        image: undefined
                    };
                }

                if (el.type === 'image' && el.imageData) {
                    try {
                        const filename = `submit_img_${index}_${Date.now()}.png`;
                        const imageUrl = await FirebaseService.uploadImage(
                            this.dataURLtoBlob(el.imageData),
                            filename
                        );
                        processed.imageUrl = imageUrl;
                        processed.imageData = undefined;
                    } catch (uploadErr) {
                        console.warn('Failed to upload image:', uploadErr);
                    }
                } else if (el.type === 'image') {
                    // Image was already loaded from a saved mindmap - preserve URL
                    processed.imageData = undefined;
                    processed.image = undefined;
                }
                
                return processed;
            }));

            const data = {
                elements: processedElements,
                connections: this.connections.map(c => ({
                    fromIndex: this.elements.indexOf(c.from),
                    toIndex: this.elements.indexOf(c.to),
                    strokeColor: c.strokeColor,
                    strokeWidth: c.strokeWidth
                }))
            };

            document.getElementById('submitModal').style.display = 'none';
            this.showLoading('Submitting to teacher...');
            
            await FirebaseService.submitMindmap(name, studentName, data);
            this.hideLoading();
            alert('✅ Mindmap submitted successfully! Your teacher will review it.');
        } catch (error) {
            this.hideLoading();
            console.error('Submit error:', error);
            alert('Failed to submit mindmap: ' + error.message);
        }
    }

    // Convert data URL to Blob for upload
    dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    // Generate thumbnail preview of the mindmap
    generateThumbnail() {
        if (this.elements.length === 0) {
            return null;
        }

        // Calculate bounds of all elements
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.elements.forEach(el => {
            const bounds = this.getElementBounds(el);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        const padding = 20;
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        // Create thumbnail canvas (max 200x150)
        const maxThumbWidth = 200;
        const maxThumbHeight = 150;
        const scale = Math.min(maxThumbWidth / contentWidth, maxThumbHeight / contentHeight, 1);

        const thumbCanvas = document.createElement('canvas');
        const thumbCtx = thumbCanvas.getContext('2d');

        thumbCanvas.width = Math.ceil(contentWidth * scale);
        thumbCanvas.height = Math.ceil(contentHeight * scale);

        // White background
        thumbCtx.fillStyle = '#ffffff';
        thumbCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);

        // Scale and translate
        thumbCtx.scale(scale, scale);
        thumbCtx.translate(-minX + padding, -minY + padding);

        // Save original state
        const originalCtx = this.ctx;
        const originalDpr = this.dpr;
        const originalPanOffset = { ...this.panOffset };
        const originalZoom = this.zoom;
        const originalSelected = [...this.selectedElements];

        // Clear selection for clean thumbnail
        this.selectedElements = [];

        // Set thumbnail context
        this.ctx = thumbCtx;
        this.dpr = 1;
        this.panOffset = { x: 0, y: 0 };
        this.zoom = 1;

        // Draw connections first
        this.connections.forEach(connection => {
            if (this.elements.includes(connection.from) && this.elements.includes(connection.to)) {
                this.drawConnection(connection);
            }
        });

        // Draw all elements
        this.elements.forEach(el => this.drawElement(el));

        // Restore original state
        this.ctx = originalCtx;
        this.dpr = originalDpr;
        this.panOffset = originalPanOffset;
        this.zoom = originalZoom;
        this.selectedElements = originalSelected;

        return thumbCanvas.toDataURL('image/png', 0.7);
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

                // Check if thumbnail exists
                const thumbnailHtml = mindmap.thumbnail
                    ? `<img src="${mindmap.thumbnail}" alt="Preview" class="mindmap-thumbnail" onerror="this.style.display='none'">`
                    : `<div class="mindmap-thumbnail-placeholder">No Preview</div>`;

                item.innerHTML = `
                    ${thumbnailHtml}
                    <div class="mindmap-info">
                        <div class="name">${mindmap.name}</div>
                        <div class="date">${mindmap.updatedAt.toLocaleDateString()}</div>
                    </div>
                    <button class="delete-btn" title="Delete">X</button>
                `;

                // Make the entire item clickable (except delete button)
                item.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('delete-btn')) {
                        this.loadMindmap(mindmap.id);
                    }
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
            document.getElementById('loadModal').style.display = 'none';
            this.showLoading('Loading mindmap...');
            const mindmap = await FirebaseService.loadMindmap(id);
            this.loadMindmapData(mindmap.data);
            // Store the loaded mindmap name for re-saving
            this.currentMindmapName = mindmap.name;
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            console.error('Load error:', error);
            alert('Failed to load mindmap: ' + error.message);
        }
    }

    loadMindmapData(data) {
        // Handle both old format (array) and new format (object with elements/connections)
        let elementsData, connectionsData;

        if (Array.isArray(data)) {
            elementsData = data;
            connectionsData = [];
        } else {
            elementsData = data.elements || [];
            connectionsData = data.connections || [];
        }

        // Track pending image loads
        let pendingImages = 0;
        const checkRender = () => {
            pendingImages--;
            if (pendingImages <= 0) {
                this.render();
            }
        };

        this.elements = elementsData.map(el => {
            // Handle standalone images
            if (el.type === 'image') {
                const imgSrc = el.imageData || el.imageUrl;
                if (imgSrc) {
                    pendingImages++;
                    this.loadImageWithFallback(imgSrc, el.imageUrl).then(img => {
                        el.image = img;
                        checkRender();
                    }).catch(err => {
                        console.warn('Failed to load image:', err);
                        checkRender();
                    });
                }
            }
            
            // Handle embedded images in shapes
            if (el.embeddedImage) {
                const imgSrc = el.embeddedImage.data || el.embeddedImage.url;
                console.log('Loading embedded image:', imgSrc ? imgSrc.substring(0, 80) + '...' : 'NO SOURCE');
                if (imgSrc) {
                    pendingImages++;
                    this.loadImageWithFallback(imgSrc, el.embeddedImage.url).then(img => {
                        console.log('✅ Embedded image loaded successfully');
                        el.embeddedImage.image = img;
                        checkRender();
                    }).catch(err => {
                        console.warn('❌ Failed to load embedded image:', err);
                        checkRender();
                    });
                } else {
                    console.warn('⚠️ Embedded image has no data or URL:', el.embeddedImage);
                }
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
        
        // Render immediately, images will re-render when loaded
        this.render();
    }

    async exportAsPng() {
        // Use html2canvas for high-quality screenshot export
        if (typeof html2canvas === 'undefined') {
            alert('Export library not loaded. Please refresh the page.');
            return;
        }

        if (this.elements.length === 0) {
            alert('Please create a mindmap before exporting.');
            return;
        }

        this.showLoading('Exporting high-quality image...');

        try {
            // Calculate bounds of all elements
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            this.elements.forEach(el => {
                const bounds = this.getElementBounds(el);
                minX = Math.min(minX, bounds.x);
                minY = Math.min(minY, bounds.y);
                maxX = Math.max(maxX, bounds.x + bounds.width);
                maxY = Math.max(maxY, bounds.y + bounds.height);
            });

            const padding = 60;
            const exportWidth = maxX - minX + padding * 2;
            const exportHeight = maxY - minY + padding * 2;

            // Create a high-res export canvas
            const scale = 3; // 3x for high definition
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = exportWidth * scale;
            tempCanvas.height = exportHeight * scale;

            // White background
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

            // Scale up for high-res
            tempCtx.scale(scale, scale);
            
            // Translate to fit content with padding
            tempCtx.translate(-minX + padding, -minY + padding);

            // Save original state
            const originalCtx = this.ctx;
            const originalDpr = this.dpr;
            const originalPanOffset = { ...this.panOffset };
            const originalZoom = this.zoom;
            const originalSelected = [...this.selectedElements];
            
            // Clear selection for clean export
            this.selectedElements = [];
            
            // Set export context
            this.ctx = tempCtx;
            this.dpr = 1;
            this.panOffset = { x: 0, y: 0 };
            this.zoom = 1;

            // Draw connections first (behind shapes)
            this.connections.forEach(connection => {
                if (this.elements.includes(connection.from) && this.elements.includes(connection.to)) {
                    this.drawConnection(connection);
                }
            });

            // Draw all elements
            this.elements.forEach(el => this.drawElement(el));
            
            // Restore original state
            this.ctx = originalCtx;
            this.dpr = originalDpr;
            this.panOffset = originalPanOffset;
            this.zoom = originalZoom;
            this.selectedElements = originalSelected;
            
            // Re-render the main canvas
            this.render();

            // Convert to blob for better quality
            tempCanvas.toBlob((blob) => {
                this.hideLoading();
                
                const link = document.createElement('a');
                link.download = `mindmap_${Date.now()}.png`;
                link.href = URL.createObjectURL(blob);
                link.click();
                
                // Cleanup
                URL.revokeObjectURL(link.href);
            }, 'image/png', 1.0);

        } catch (error) {
            this.hideLoading();
            console.error('Export error:', error);
            alert('Failed to export: ' + error.message);
        }
    }

    // Auth Setup
    setupAuth() {
        const signInBtn = document.getElementById('signInBtn');
        const userStatus = document.getElementById('userStatus');
        const adminBtn = document.getElementById('adminBtn');
        const loginModal = document.getElementById('loginModal');
        const closeLoginModal = document.getElementById('closeLoginModal');
        
        // Forms
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');
        const verificationPending = document.getElementById('verificationPending');
        
        // Login form elements
        const loginEmail = document.getElementById('loginEmail');
        const loginPassword = document.getElementById('loginPassword');
        const submitLogin = document.getElementById('submitLogin');
        const googleSignIn = document.getElementById('googleSignIn');
        const loginError = document.getElementById('loginError');
        
        // Register form elements
        const registerEmail = document.getElementById('registerEmail');
        const registerPassword = document.getElementById('registerPassword');
        const confirmPassword = document.getElementById('confirmPassword');
        const submitRegister = document.getElementById('submitRegister');
        const registerError = document.getElementById('registerError');
        
        // Forgot password elements
        const resetEmail = document.getElementById('resetEmail');
        const submitReset = document.getElementById('submitReset');
        const resetError = document.getElementById('resetError');
        const resetSuccess = document.getElementById('resetSuccess');
        
        // Navigation links
        const showRegister = document.getElementById('showRegister');
        const showLogin = document.getElementById('showLogin');
        const showForgotPassword = document.getElementById('showForgotPassword');
        const showLoginFromReset = document.getElementById('showLoginFromReset');
        const backToLogin = document.getElementById('backToLogin');
        
        // Verification elements
        const verificationEmail = document.getElementById('verificationEmail');
        const resendVerification = document.getElementById('resendVerification');
        const checkVerification = document.getElementById('checkVerification');
        
        // Admin panel
        const adminPanel = document.getElementById('adminPanel');
        const closeAdminPanel = document.getElementById('closeAdminPanel');
        const adminMindmapList = document.getElementById('adminMindmapList');

        // Helper functions
        const showForm = (form) => {
            loginForm.style.display = 'none';
            registerForm.style.display = 'none';
            forgotPasswordForm.style.display = 'none';
            verificationPending.style.display = 'none';
            form.style.display = 'block';
            
            // Update title
            const title = document.getElementById('loginModalTitle');
            if (form === loginForm) title.textContent = 'Sign In';
            else if (form === registerForm) title.textContent = 'Create Account';
            else if (form === forgotPasswordForm) title.textContent = 'Reset Password';
            else if (form === verificationPending) title.textContent = 'Verify Email';
        };

        const hideError = (el) => { el.style.display = 'none'; el.textContent = ''; };
        const showError = (el, msg) => { el.style.display = 'block'; el.textContent = msg; };

        // Sign in button - open modal or sign out
        signInBtn.addEventListener('click', async () => {
            if (FirebaseService.getCurrentUser()) {
                await FirebaseService.signOut();
            } else {
                showForm(loginForm);
                hideError(loginError);
                loginModal.style.display = 'flex';
            }
        });

        // Close modal
        closeLoginModal.addEventListener('click', () => {
            loginModal.style.display = 'none';
        });

        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) loginModal.style.display = 'none';
        });

        // Navigation between forms
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            showForm(registerForm);
            hideError(registerError);
        });

        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showForm(loginForm);
            hideError(loginError);
        });

        showForgotPassword.addEventListener('click', (e) => {
            e.preventDefault();
            showForm(forgotPasswordForm);
            hideError(resetError);
            resetSuccess.style.display = 'none';
        });

        showLoginFromReset.addEventListener('click', (e) => {
            e.preventDefault();
            showForm(loginForm);
            hideError(loginError);
        });

        backToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            showForm(loginForm);
            hideError(loginError);
        });

        // Email/Password Login
        submitLogin.addEventListener('click', async () => {
            hideError(loginError);
            const email = loginEmail.value.trim();
            const password = loginPassword.value;

            if (!email || !password) {
                showError(loginError, 'Please enter email and password');
                return;
            }

            try {
                submitLogin.disabled = true;
                submitLogin.textContent = 'Signing in...';
                const result = await FirebaseService.signInWithEmail(email, password);
                
                // Check if email is verified (skip for admin)
                if (!result.user.emailVerified && result.user.email !== ADMIN_EMAIL) {
                    verificationEmail.textContent = result.user.email;
                    showForm(verificationPending);
                } else {
                    loginModal.style.display = 'none';
                }
            } catch (error) {
                console.error('Login error:', error);
                let message = 'Failed to sign in';
                if (error.code === 'auth/user-not-found') message = 'No account found with this email';
                else if (error.code === 'auth/wrong-password') message = 'Incorrect password';
                else if (error.code === 'auth/invalid-email') message = 'Invalid email address';
                else if (error.code === 'auth/too-many-requests') message = 'Too many attempts. Try again later.';
                showError(loginError, message);
            } finally {
                submitLogin.disabled = false;
                submitLogin.textContent = 'Sign In';
            }
        });

        // Google Sign In
        googleSignIn.addEventListener('click', async () => {
            try {
                await FirebaseService.signInWithGoogle();
                loginModal.style.display = 'none';
            } catch (error) {
                console.error('Google sign in error:', error);
                if (error.code !== 'auth/popup-closed-by-user') {
                    showError(loginError, 'Failed to sign in with Google');
                }
            }
        });

        // Registration
        submitRegister.addEventListener('click', async () => {
            hideError(registerError);
            const email = registerEmail.value.trim();
            const password = registerPassword.value;
            const confirm = confirmPassword.value;

            if (!email || !password || !confirm) {
                showError(registerError, 'Please fill in all fields');
                return;
            }

            if (password.length < 6) {
                showError(registerError, 'Password must be at least 6 characters');
                return;
            }

            if (password !== confirm) {
                showError(registerError, 'Passwords do not match');
                return;
            }

            try {
                submitRegister.disabled = true;
                submitRegister.textContent = 'Creating account...';
                const result = await FirebaseService.registerWithEmail(email, password);
                verificationEmail.textContent = result.user.email;
                showForm(verificationPending);
            } catch (error) {
                console.error('Registration error:', error);
                let message = 'Failed to create account';
                if (error.code === 'auth/email-already-in-use') message = 'Email already registered';
                else if (error.code === 'auth/invalid-email') message = 'Invalid email address';
                else if (error.code === 'auth/weak-password') message = 'Password is too weak';
                showError(registerError, message);
            } finally {
                submitRegister.disabled = false;
                submitRegister.textContent = 'Create Account';
            }
        });

        // Password Reset
        submitReset.addEventListener('click', async () => {
            hideError(resetError);
            resetSuccess.style.display = 'none';
            const email = resetEmail.value.trim();

            if (!email) {
                showError(resetError, 'Please enter your email');
                return;
            }

            try {
                submitReset.disabled = true;
                submitReset.textContent = 'Sending...';
                await FirebaseService.sendPasswordResetEmail(email);
                resetSuccess.style.display = 'block';
                resetSuccess.textContent = 'Reset link sent! Check your email.';
            } catch (error) {
                console.error('Password reset error:', error);
                let message = 'Failed to send reset email';
                if (error.code === 'auth/user-not-found') message = 'No account found with this email';
                else if (error.code === 'auth/invalid-email') message = 'Invalid email address';
                showError(resetError, message);
            } finally {
                submitReset.disabled = false;
                submitReset.textContent = 'Send Reset Link';
            }
        });

        // Resend verification email
        resendVerification.addEventListener('click', async () => {
            try {
                resendVerification.disabled = true;
                resendVerification.textContent = 'Sending...';
                await FirebaseService.sendVerificationEmail();
                resendVerification.textContent = 'Email Sent!';
                setTimeout(() => {
                    resendVerification.disabled = false;
                    resendVerification.textContent = 'Resend Email';
                }, 3000);
            } catch (error) {
                console.error('Resend verification error:', error);
                alert('Failed to resend verification email');
                resendVerification.disabled = false;
                resendVerification.textContent = 'Resend Email';
            }
        });

        // Check verification
        checkVerification.addEventListener('click', async () => {
            const user = FirebaseService.getCurrentUser();
            if (user) {
                await user.reload();
                if (user.emailVerified) {
                    loginModal.style.display = 'none';
                } else {
                    alert('Email not yet verified. Please check your inbox and click the verification link.');
                }
            }
        });

        // Admin panel button
        adminBtn.addEventListener('click', async () => {
            adminPanel.style.display = 'block';
            adminMindmapList.innerHTML = '<p>Loading student submissions...</p>';
            
            try {
                const submissions = await FirebaseService.loadAllSubmissions();
                if (submissions.length === 0) {
                    adminMindmapList.innerHTML = '<p>No student submissions yet.</p>';
                } else {
                    adminMindmapList.innerHTML = submissions.map(s => `
                        <div class="admin-mindmap-item" data-id="${s.id}">
                            <div class="info">
                                <div class="name">${s.name || 'Untitled'}</div>
                                <div class="student-name">👤 ${s.studentName || 'Unknown'}</div>
                                <div class="email">${s.userEmail || ''}</div>
                                <div class="date">📅 ${s.submittedAt ? s.submittedAt.toLocaleString() : ''}</div>
                                <div class="status ${s.status || 'pending'}">${(s.status || 'pending').toUpperCase()}</div>
                            </div>
                        </div>
                    `).join('');
                    
                    // Click to load submission
                    adminMindmapList.querySelectorAll('.admin-mindmap-item').forEach(item => {
                        item.addEventListener('click', async () => {
                            const id = item.dataset.id;
                            try {
                                const submission = await FirebaseService.loadSubmission(id);
                                this.loadMindmapData(submission.data);
                                adminPanel.style.display = 'none';
                            } catch (error) {
                                console.error('Load error:', error);
                                alert('Failed to load submission');
                            }
                        });
                    });
                }
            } catch (error) {
                console.error('Admin load error:', error);
                adminMindmapList.innerHTML = '<p>Failed to load submissions.</p>';
            }
        });

        closeAdminPanel.addEventListener('click', () => {
            adminPanel.style.display = 'none';
        });

        // Auth state changes
        FirebaseService.onAuthStateChanged(async (user) => {
            const assignmentsBtn = document.getElementById('assignmentsBtn');
            const profileBtn = document.getElementById('profileBtn');
            const adminAssignmentsBtn = document.getElementById('adminAssignmentsBtn');
            
            if (user) {
                const verified = user.emailVerified || user.email === ADMIN_EMAIL;
                userStatus.innerHTML = user.email + (verified ?
                    '<span class="verified-badge">✓</span>' :
                    '<span class="unverified-badge">⚠ Unverified</span>');
                signInBtn.textContent = 'Sign Out';

                // Show admin buttons if admin
                if (FirebaseService.isAdmin()) {
                    adminBtn.style.display = 'inline-block';
                    adminAssignmentsBtn.style.display = 'inline-block';
                    assignmentsBtn.style.display = 'none';
                    profileBtn.style.display = 'none';
                } else {
                    adminBtn.style.display = 'none';
                    adminAssignmentsBtn.style.display = 'none';
                    
                    // Show student buttons
                    assignmentsBtn.style.display = 'inline-block';
                    profileBtn.style.display = 'inline-block';
                    
                    // Check if profile is complete, prompt if not
                    if (verified) {
                        try {
                            const profileComplete = await FirebaseService.isProfileComplete();
                            if (!profileComplete) {
                                // Show profile setup modal after a short delay
                                setTimeout(() => this.showProfileModal(), 500);
                            }
                        } catch (error) {
                            console.error('Error checking profile:', error);
                        }
                    }
                }
            } else {
                userStatus.textContent = 'Not signed in';
                signInBtn.textContent = 'Sign In';
                adminBtn.style.display = 'none';
                adminAssignmentsBtn.style.display = 'none';
                assignmentsBtn.style.display = 'none';
                profileBtn.style.display = 'none';
            }
        });
        
        // Setup profile and assignments after auth
        this.setupProfileSystem();
        this.setupAssignmentsSystem();
    }

    // Tutorial System
    setupTutorial() {
        this.tutorialSteps = [
            {
                icon: '👋',
                title: 'Welcome to Mindmap!',
                content: `
                    <p>This interactive tutorial will guide you through all the features of the Mindmap app. You'll learn how to create, edit, and organize your ideas visually.</p>
                    <div class="highlight">
                        <strong>What you'll learn:</strong>
                        <ul style="margin: 10px 0 0 20px; color: #555;">
                            <li>Creating and editing shapes</li>
                            <li>Connecting ideas with arrows</li>
                            <li>Multi-select and bulk editing</li>
                            <li>Smart alignment and snapping</li>
                            <li>Keyboard shortcuts for speed</li>
                        </ul>
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">💡</span>
                        <p>You can access this tutorial anytime by clicking the <strong>Tutorial</strong> button in the toolbar.</p>
                    </div>
                `
            },
            {
                icon: '🔷',
                title: 'Creating Shapes',
                content: `
                    <p>The toolbar at the top contains all the shape tools you need to build your mindmap.</p>
                    <div class="feature-grid">
                        <div class="feature-card">
                            <h4>▭ Rectangle</h4>
                            <p>Great for main ideas and topics. Press <kbd>R</kbd> or click the button.</p>
                        </div>
                        <div class="feature-card">
                            <h4>○ Circle</h4>
                            <p>Perfect for central concepts. Press <kbd>C</kbd> or click the button.</p>
                        </div>
                        <div class="feature-card">
                            <h4>◇ Diamond</h4>
                            <p>Ideal for decision points. Press <kbd>D</kbd> or click the button.</p>
                        </div>
                        <div class="feature-card">
                            <h4>△ Triangle</h4>
                            <p>Use for hierarchy or warnings. Press <kbd>T</kbd> or click the button.</p>
                        </div>
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">💡</span>
                        <p>Click anywhere on the canvas after selecting a tool to place a shape. Each shape gets a random pastel color!</p>
                    </div>
                `
            },
            {
                icon: '✏️',
                title: 'Adding Text to Shapes',
                content: `
                    <p>Adding text to your shapes is quick and intuitive. There are multiple ways to do it:</p>
                    <div class="highlight">
                        <strong>Method 1: Double-click</strong><br>
                        Double-click on any shape to open the text editor.
                    </div>
                    <div class="highlight">
                        <strong>Method 2: Direct typing</strong><br>
                        Select a shape and just start typing! The text will appear immediately.
                    </div>
                    <div class="highlight">
                        <strong>Method 3: Text Tool</strong><br>
                        Press <kbd>X</kbd> to create a standalone text box without a shape.
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">💡</span>
                        <p>Text automatically wraps and resizes to fit within shapes. Press <kbd>Shift+Enter</kbd> for a new line, or <kbd>Enter</kbd> to finish editing.</p>
                    </div>
                `
            },
            {
                icon: '🔗',
                title: 'Connecting Shapes with Arrows',
                content: `
                    <p>Arrows help you show relationships between ideas. There are two ways to create connections:</p>
                    <div class="highlight">
                        <strong>Method 1: Arrow Connection Mode (Recommended)</strong><br>
                        <ol style="margin: 10px 0 0 20px; color: #555;">
                            <li>Press <kbd>A</kbd> to enter arrow mode</li>
                            <li>Click on the source shape</li>
                            <li>Click on the target shape</li>
                        </ol>
                        The arrow will automatically route around shapes!
                    </div>
                    <div class="highlight">
                        <strong>Method 2: Drag from Connection Points</strong><br>
                        Select a shape, then drag from any of the green dots to another shape.
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">💡</span>
                        <p>Press <kbd>Tab</kbd> on a selected shape to create a connected child shape. Press <kbd>Enter</kbd> to create a sibling below.</p>
                    </div>
                `
            },
            {
                icon: '👆',
                title: 'Selecting Elements',
                content: `
                    <p>Master selection to work efficiently with multiple elements at once.</p>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>Click</kbd>
                            <span>Select single element</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Shift+Click</kbd>
                            <span>Add to selection</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+Click</kbd>
                            <span>Toggle selection</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+A</kbd>
                            <span>Select all elements</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Drag</kbd>
                            <span>Selection box</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Escape</kbd>
                            <span>Deselect all</span>
                        </div>
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">💡</span>
                        <p>When multiple shapes are selected, changing colors or stroke in the Properties panel applies to all of them at once!</p>
                    </div>
                `
            },
            {
                icon: '🎯',
                title: 'Smart Alignment & Snapping',
                content: `
                    <p>The app helps you create clean, aligned layouts automatically.</p>
                    <div class="feature-grid">
                        <div class="feature-card">
                            <h4>📏 Alignment Guides</h4>
                            <p>When you move shapes, dotted guide lines appear when edges or centers align with other shapes - just like PowerPoint!</p>
                        </div>
                        <div class="feature-card">
                            <h4>🧲 Smart Snapping</h4>
                            <p>Shapes snap to alignment guides automatically, making it easy to create organized layouts.</p>
                        </div>
                        <div class="feature-card">
                            <h4>📐 Line Snapping</h4>
                            <p>When drawing arrows or lines, they snap to horizontal or vertical when close to those angles.</p>
                        </div>
                        <div class="feature-card">
                            <h4>⚖️ Proportional Resize</h4>
                            <p>Hold <kbd>Shift</kbd> while resizing to maintain the shape's aspect ratio.</p>
                        </div>
                    </div>
                `
            },
            {
                icon: '🎨',
                title: 'Customizing Appearance',
                content: `
                    <p>Make your mindmap visually appealing with colors and styles.</p>
                    <div class="highlight">
                        <strong>Toolbar Quick Colors</strong><br>
                        Use the color pickers in the toolbar to set default colors for new shapes, or quickly change selected shapes.
                    </div>
                    <div class="highlight">
                        <strong>Properties Panel (Right Side)</strong><br>
                        When shapes are selected, the Properties panel shows:
                        <ul style="margin: 10px 0 0 20px; color: #555;">
                            <li>Text content and font size</li>
                            <li>Font family selection</li>
                            <li>Fill and stroke colors</li>
                            <li>Stroke width</li>
                            <li>Image position (for embedded images)</li>
                        </ul>
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">💡</span>
                        <p>You can paste images into shapes! Just select a shape and press <kbd>Ctrl+V</kbd> with an image in your clipboard.</p>
                    </div>
                `
            },
            {
                icon: '⌨️',
                title: 'Keyboard Shortcuts',
                content: `
                    <p>Speed up your workflow with these essential shortcuts:</p>
                    <div class="shortcut-list">
                        <div class="shortcut-item">
                            <kbd>V</kbd>
                            <span>Select tool</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>R</kbd>
                            <span>Rectangle</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>C</kbd>
                            <span>Circle</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>D</kbd>
                            <span>Diamond</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>T</kbd>
                            <span>Triangle</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>A</kbd>
                            <span>Arrow mode</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>L</kbd>
                            <span>Line</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>X</kbd>
                            <span>Text box</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Del</kbd>
                            <span>Delete selected</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+Z</kbd>
                            <span>Undo</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+Y</kbd>
                            <span>Redo</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+D</kbd>
                            <span>Duplicate</span>
                        </div>
                    </div>
                `
            },
            {
                icon: '🖱️',
                title: 'Navigation & View',
                content: `
                    <p>Navigate around large mindmaps with ease.</p>
                    <div class="feature-grid">
                        <div class="feature-card">
                            <h4>🔍 Zoom</h4>
                            <p>Use your mouse scroll wheel to zoom in and out. Zoom centers on your cursor position.</p>
                        </div>
                        <div class="feature-card">
                            <h4>✋ Pan</h4>
                            <p>Click and drag on empty canvas space to pan around. Or hold <kbd>Shift</kbd> while clicking.</p>
                        </div>
                        <div class="feature-card">
                            <h4>🔄 Middle Mouse</h4>
                            <p>Middle-click and drag also pans the canvas view.</p>
                        </div>
                        <div class="feature-card">
                            <h4>↔️ Resize Shapes</h4>
                            <p>Drag the square handles on selected shapes to resize them.</p>
                        </div>
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">💡</span>
                        <p>The canvas is infinite! Pan and zoom to work on mindmaps of any size.</p>
                    </div>
                `
            },
            {
                icon: '💾',
                title: 'Saving & Sharing',
                content: `
                    <p>Save your work and share it with others.</p>
                    <div class="feature-grid">
                        <div class="feature-card">
                            <h4>💾 Save Draft</h4>
                            <p>Press <kbd>Ctrl+S</kbd> or click Save to store your mindmap in the cloud. Sign in required.</p>
                        </div>
                        <div class="feature-card">
                            <h4>📂 Load Saved</h4>
                            <p>Press <kbd>Ctrl+O</kbd> or click Saved Maps to load a previously saved mindmap.</p>
                        </div>
                        <div class="feature-card">
                            <h4>📤 Submit</h4>
                            <p>Click Submit to send your mindmap to your teacher for review.</p>
                        </div>
                        <div class="feature-card">
                            <h4>📷 Export</h4>
                            <p>Click Export to download your mindmap as a high-quality PNG image.</p>
                        </div>
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">💡</span>
                        <p>Your mindmaps are automatically saved with thumbnails for easy preview!</p>
                    </div>
                `
            },
            {
                icon: '🎉',
                title: 'You\'re Ready!',
                content: `
                    <p>You now know everything you need to create amazing mindmaps!</p>
                    <div class="highlight">
                        <strong>Quick Reference:</strong>
                        <ul style="margin: 10px 0 0 20px; color: #555;">
                            <li><strong>Shapes:</strong> R, C, D, T keys or toolbar buttons</li>
                            <li><strong>Connect:</strong> Press A, click source, click target</li>
                            <li><strong>Multi-select:</strong> Shift+Click or Ctrl+Click</li>
                            <li><strong>Edit text:</strong> Double-click or just start typing</li>
                            <li><strong>Alignment:</strong> Automatic guides appear while moving</li>
                            <li><strong>Navigate:</strong> Scroll to zoom, drag empty space to pan</li>
                        </ul>
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">🚀</span>
                        <p>Start by pressing <kbd>R</kbd> to create a rectangle, type your main topic, then press <kbd>Tab</kbd> to create connected subtopics!</p>
                    </div>
                `
            }
        ];

        this.currentTutorialStep = 0;

        const tutorialBtn = document.getElementById('tutorialBtn');
        const tutorialModal = document.getElementById('tutorialModal');
        const closeTutorialModal = document.getElementById('closeTutorialModal');
        const tutorialPrev = document.getElementById('tutorialPrev');
        const tutorialNext = document.getElementById('tutorialNext');
        const tutorialFinish = document.getElementById('tutorialFinish');

        tutorialBtn.addEventListener('click', () => this.showTutorial());
        closeTutorialModal.addEventListener('click', () => {
            tutorialModal.style.display = 'none';
        });

        tutorialModal.addEventListener('click', (e) => {
            if (e.target === tutorialModal) {
                tutorialModal.style.display = 'none';
            }
        });

        tutorialPrev.addEventListener('click', () => this.prevTutorialStep());
        tutorialNext.addEventListener('click', () => this.nextTutorialStep());
        tutorialFinish.addEventListener('click', () => {
            tutorialModal.style.display = 'none';
        });
    }

    showTutorial() {
        this.currentTutorialStep = 0;
        this.renderTutorialStep();
        document.getElementById('tutorialModal').style.display = 'flex';
    }

    renderTutorialStep() {
        const step = this.tutorialSteps[this.currentTutorialStep];
        const content = document.getElementById('tutorialContent');
        const indicator = document.getElementById('tutorialStepIndicator');
        const progressBar = document.getElementById('tutorialProgressBar');
        const prevBtn = document.getElementById('tutorialPrev');
        const nextBtn = document.getElementById('tutorialNext');
        const finishBtn = document.getElementById('tutorialFinish');

        content.innerHTML = `
            <div class="tutorial-step">
                <h3><span class="step-icon">${step.icon}</span> ${step.title}</h3>
                ${step.content}
            </div>
        `;

        indicator.textContent = `Step ${this.currentTutorialStep + 1} of ${this.tutorialSteps.length}`;
        progressBar.style.width = `${((this.currentTutorialStep + 1) / this.tutorialSteps.length) * 100}%`;

        prevBtn.style.display = this.currentTutorialStep === 0 ? 'none' : 'inline-block';

        if (this.currentTutorialStep === this.tutorialSteps.length - 1) {
            nextBtn.style.display = 'none';
            finishBtn.style.display = 'inline-block';
        } else {
            nextBtn.style.display = 'inline-block';
            finishBtn.style.display = 'none';
        }
    }

    prevTutorialStep() {
        if (this.currentTutorialStep > 0) {
            this.currentTutorialStep--;
            this.renderTutorialStep();
        }
    }

    nextTutorialStep() {
        if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
            this.currentTutorialStep++;
            this.renderTutorialStep();
        }
    }

    // ==========================================
    // PROFILE SYSTEM
    // ==========================================
    
    setupProfileSystem() {
        const profileModal = document.getElementById('profileModal');
        const profileBtn = document.getElementById('profileBtn');
        const saveProfile = document.getElementById('saveProfile');
        const closeProfileModal = document.getElementById('closeProfileModal');
        const profileLevel = document.getElementById('profileLevel');
        const profileError = document.getElementById('profileError');
        
        // Populate levels dropdown
        if (window.STUDENT_LEVELS) {
            profileLevel.innerHTML = '<option value="">Select your level...</option>' +
                window.STUDENT_LEVELS.map(l => `<option value="${l}">${l}</option>`).join('');
        }
        
        // Profile button click
        profileBtn.addEventListener('click', () => this.showProfileModal());
        
        // Close modal
        closeProfileModal.addEventListener('click', () => {
            profileModal.style.display = 'none';
        });
        
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) profileModal.style.display = 'none';
        });
        
        // Save profile
        saveProfile.addEventListener('click', async () => {
            const name = document.getElementById('profileStudentName').value.trim();
            const level = profileLevel.value;
            const address = document.getElementById('profileAddress').value.trim();
            
            profileError.style.display = 'none';
            
            if (!name) {
                profileError.textContent = 'Please enter your name';
                profileError.style.display = 'block';
                return;
            }
            if (!level) {
                profileError.textContent = 'Please select your level';
                profileError.style.display = 'block';
                return;
            }
            if (!address) {
                profileError.textContent = 'Please enter your address for prize delivery';
                profileError.style.display = 'block';
                return;
            }
            
            try {
                saveProfile.disabled = true;
                saveProfile.textContent = 'Saving...';
                
                await FirebaseService.saveUserProfile({
                    studentName: name,
                    level: level,
                    address: address
                });
                
                profileModal.style.display = 'none';
                alert('✅ Profile saved successfully!');
            } catch (error) {
                console.error('Save profile error:', error);
                profileError.textContent = 'Failed to save profile: ' + error.message;
                profileError.style.display = 'block';
            } finally {
                saveProfile.disabled = false;
                saveProfile.textContent = 'Save Profile';
            }
        });
    }
    
    async showProfileModal() {
        const profileModal = document.getElementById('profileModal');
        const profileStudentName = document.getElementById('profileStudentName');
        const profileLevel = document.getElementById('profileLevel');
        const profileAddress = document.getElementById('profileAddress');
        const profileError = document.getElementById('profileError');
        
        profileError.style.display = 'none';
        
        // Load existing profile if any
        try {
            const profile = await FirebaseService.getUserProfile();
            if (profile) {
                profileStudentName.value = profile.studentName || '';
                profileLevel.value = profile.level || '';
                profileAddress.value = profile.address || '';
            }
        } catch (error) {
            console.error('Load profile error:', error);
        }
        
        profileModal.style.display = 'flex';
    }

    // ==========================================
    // ASSIGNMENTS SYSTEM
    // ==========================================
    
    setupAssignmentsSystem() {
        // Current assignment being worked on
        this.currentAssignmentId = null;
        
        // Student: Assignments panel
        const assignmentsBtn = document.getElementById('assignmentsBtn');
        const assignmentsPanel = document.getElementById('assignmentsPanel');
        const closeAssignmentsPanel = document.getElementById('closeAssignmentsPanel');
        
        assignmentsBtn.addEventListener('click', () => this.showAssignmentsPanel());
        closeAssignmentsPanel.addEventListener('click', () => {
            assignmentsPanel.style.display = 'none';
        });
        
        // Assignment detail modal
        const assignmentDetailModal = document.getElementById('assignmentDetailModal');
        const closeAssignmentDetail = document.getElementById('closeAssignmentDetail');
        
        closeAssignmentDetail.addEventListener('click', () => {
            assignmentDetailModal.style.display = 'none';
        });
        
        assignmentDetailModal.addEventListener('click', (e) => {
            if (e.target === assignmentDetailModal) assignmentDetailModal.style.display = 'none';
        });
        
        // Submit assignment modal
        const submitAssignmentModal = document.getElementById('submitAssignmentModal');
        const closeSubmitAssignmentModal = document.getElementById('closeSubmitAssignmentModal');
        const confirmAssignmentSubmit = document.getElementById('confirmAssignmentSubmit');
        
        closeSubmitAssignmentModal.addEventListener('click', () => {
            submitAssignmentModal.style.display = 'none';
        });
        
        submitAssignmentModal.addEventListener('click', (e) => {
            if (e.target === submitAssignmentModal) submitAssignmentModal.style.display = 'none';
        });
        
        confirmAssignmentSubmit.addEventListener('click', () => this.submitAssignmentMindmap());
        
        // Admin: Assignments management
        const adminAssignmentsBtn = document.getElementById('adminAssignmentsBtn');
        const adminAssignmentsPanel = document.getElementById('adminAssignmentsPanel');
        const closeAdminAssignmentsPanel = document.getElementById('closeAdminAssignmentsPanel');
        const createAssignmentBtn = document.getElementById('createAssignmentBtn');
        
        adminAssignmentsBtn.addEventListener('click', () => this.showAdminAssignmentsPanel());
        closeAdminAssignmentsPanel.addEventListener('click', () => {
            adminAssignmentsPanel.style.display = 'none';
        });
        createAssignmentBtn.addEventListener('click', () => this.showAssignmentForm());
        
        // Assignment form modal
        const assignmentFormModal = document.getElementById('assignmentFormModal');
        const closeAssignmentForm = document.getElementById('closeAssignmentForm');
        const saveAssignment = document.getElementById('saveAssignment');
        const assignmentLevels = document.getElementById('assignmentLevels');
        
        // Populate levels checkboxes
        if (window.STUDENT_LEVELS) {
            assignmentLevels.innerHTML = window.STUDENT_LEVELS.map(l => 
                `<label><input type="checkbox" value="${l}"><span>${l}</span></label>`
            ).join('');
        }
        
        closeAssignmentForm.addEventListener('click', () => {
            assignmentFormModal.style.display = 'none';
        });
        
        assignmentFormModal.addEventListener('click', (e) => {
            if (e.target === assignmentFormModal) assignmentFormModal.style.display = 'none';
        });
        
        saveAssignment.addEventListener('click', () => this.saveAssignmentForm());
        
        // View submissions modal
        const viewSubmissionsModal = document.getElementById('viewSubmissionsModal');
        const closeViewSubmissions = document.getElementById('closeViewSubmissions');
        const closeAssignmentBtn = document.getElementById('closeAssignmentBtn');
        
        closeViewSubmissions.addEventListener('click', () => {
            viewSubmissionsModal.style.display = 'none';
        });
        
        viewSubmissionsModal.addEventListener('click', (e) => {
            if (e.target === viewSubmissionsModal) viewSubmissionsModal.style.display = 'none';
        });
        
        closeAssignmentBtn.addEventListener('click', () => this.closeAssignmentAndPickWinner());
        
        // Grade modal
        const gradeModal = document.getElementById('gradeModal');
        const closeGradeModal = document.getElementById('closeGradeModal');
        const saveGrade = document.getElementById('saveGrade');
        
        closeGradeModal.addEventListener('click', () => {
            gradeModal.style.display = 'none';
        });
        
        gradeModal.addEventListener('click', (e) => {
            if (e.target === gradeModal) gradeModal.style.display = 'none';
        });
        
        saveGrade.addEventListener('click', () => this.saveGradeForm());
        
        // Winner modal
        const winnerModal = document.getElementById('winnerModal');
        const closeWinnerModal = document.getElementById('closeWinnerModal');
        
        closeWinnerModal.addEventListener('click', () => {
            winnerModal.style.display = 'none';
        });
        
        winnerModal.addEventListener('click', (e) => {
            if (e.target === winnerModal) winnerModal.style.display = 'none';
        });
    }
    
    // Student: Show assignments panel
    async showAssignmentsPanel() {
        const assignmentsPanel = document.getElementById('assignmentsPanel');
        const assignmentsList = document.getElementById('assignmentsList');
        
        assignmentsPanel.style.display = 'flex';
        assignmentsList.innerHTML = '<p>Loading assignments...</p>';
        
        try {
            // Check profile first
            const profile = await FirebaseService.getUserProfile();
            if (!profile || !profile.level) {
                assignmentsList.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">📝</div>
                        <h4>Complete Your Profile</h4>
                        <p>Please set up your profile first to see assignments for your level.</p>
                        <button class="action-btn primary" onclick="mindmapApp.showProfileModal()">Set Up Profile</button>
                    </div>
                `;
                return;
            }
            
            const assignments = await FirebaseService.getAssignmentsForLevel(profile.level);
            
            if (assignments.length === 0) {
                assignmentsList.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">📋</div>
                        <h4>No Assignments</h4>
                        <p>There are no active assignments for ${profile.level} right now.</p>
                    </div>
                `;
                return;
            }
            
            // Check submission status for each assignment
            const assignmentsWithStatus = await Promise.all(assignments.map(async (a) => {
                const submission = await FirebaseService.getUserSubmissionForAssignment(a.id);
                return { ...a, submission };
            }));
            
            assignmentsList.innerHTML = assignmentsWithStatus.map(a => {
                const isDeadlineSoon = a.deadline && (a.deadline - new Date()) < 24 * 60 * 60 * 1000;
                const statusClass = a.submission ? (a.submission.status === 'graded' ? 'graded' : 'submitted') : '';
                
                return `
                    <div class="assignment-card ${statusClass}" data-id="${a.id}">
                        <h4>${a.topic}</h4>
                        ${a.description ? `<p style="color: #666; font-size: 13px;">${a.description}</p>` : ''}
                        <div class="prize">🎁 Prize: ${a.prize}</div>
                        <div class="deadline ${isDeadlineSoon ? 'soon' : ''}">
                            ⏰ Deadline: ${a.deadline ? a.deadline.toLocaleString() : 'No deadline'}
                        </div>
                        ${a.submission ? `
                            <span class="status-badge ${a.submission.status}">
                                ${a.submission.status === 'graded' ? `✅ Graded: ${a.submission.score}/100` : '📤 Submitted'}
                            </span>
                        ` : ''}
                    </div>
                `;
            }).join('');
            
            // Click handlers
            assignmentsList.querySelectorAll('.assignment-card').forEach(card => {
                card.addEventListener('click', () => {
                    const assignment = assignmentsWithStatus.find(a => a.id === card.dataset.id);
                    this.showAssignmentDetail(assignment);
                });
            });
            
        } catch (error) {
            console.error('Load assignments error:', error);
            assignmentsList.innerHTML = '<p>Failed to load assignments.</p>';
        }
    }
    
    // Student: Show assignment detail
    async showAssignmentDetail(assignment) {
        const modal = document.getElementById('assignmentDetailModal');
        const content = document.getElementById('assignmentDetailContent');
        
        const isDeadlinePassed = assignment.deadline && assignment.deadline < new Date();
        const hasSubmission = !!assignment.submission;
        
        content.innerHTML = `
            <h2>${assignment.topic}</h2>
            ${assignment.description ? `<p style="color: #666;">${assignment.description}</p>` : ''}
            
            <div class="prize-banner">
                <h3>🎁 ${assignment.prize}</h3>
                <p>Prize for the highest scorer!</p>
            </div>
            
            <div class="deadline-banner">
                <span>⏰</span>
                <span>Deadline: ${assignment.deadline ? assignment.deadline.toLocaleString() : 'No deadline'}</span>
            </div>
            
            ${hasSubmission ? `
                <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <strong>Your Submission:</strong><br>
                    Status: ${assignment.submission.status === 'graded' ? 
                        `<span style="color: #28a745;">Graded - ${assignment.submission.score}/100</span>` : 
                        '<span style="color: #17a2b8;">Submitted - Awaiting grading</span>'
                    }
                    ${assignment.submission.feedback ? `<br><br>Feedback: ${assignment.submission.feedback}` : ''}
                </div>
            ` : ''}
            
            <div class="action-buttons">
                ${isDeadlinePassed ? `
                    <button class="action-btn" disabled>Deadline Passed</button>
                ` : `
                    <button class="action-btn primary" id="buildMindmapBtn">
                        ${hasSubmission ? '📝 Edit & Resubmit' : '🎨 Build Mind Map'}
                    </button>
                `}
                <button class="action-btn" onclick="document.getElementById('assignmentDetailModal').style.display='none'">Close</button>
            </div>
        `;
        
        // Build mindmap button
        const buildBtn = content.querySelector('#buildMindmapBtn');
        if (buildBtn) {
            buildBtn.addEventListener('click', async () => {
                this.currentAssignmentId = assignment.id;
                
                // If has previous submission, load it
                if (hasSubmission && assignment.submission.data) {
                    this.loadMindmapData(assignment.submission.data);
                } else {
                    // Clear canvas and start fresh
                    this.elements = [];
                    this.connections = [];
                    this.selectedElements = [];
                    this.saveState();
                    this.render();
                }
                
                modal.style.display = 'none';
                document.getElementById('assignmentsPanel').style.display = 'none';
                
                // Show notification about current assignment
                this.showAssignmentNotification(assignment.topic);
            });
        }
        
        modal.style.display = 'flex';
    }
    
    showAssignmentNotification(topic) {
        // Create a notification bar
        let notification = document.getElementById('assignmentNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'assignmentNotification';
            notification.style.cssText = `
                position: fixed;
                top: 60px;
                left: 50%;
                transform: translateX(-50%);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 1000;
                display: flex;
                align-items: center;
                gap: 15px;
                font-size: 14px;
            `;
            document.body.appendChild(notification);
        }
        
        notification.innerHTML = `
            <span>📋 Working on: <strong>${topic}</strong></span>
            <button id="submitAssignmentBtn" style="
                background: white;
                color: #667eea;
                border: none;
                padding: 6px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: 600;
            ">Submit</button>
            <button id="cancelAssignmentBtn" style="
                background: transparent;
                color: white;
                border: 1px solid rgba(255,255,255,0.5);
                padding: 6px 15px;
                border-radius: 5px;
                cursor: pointer;
            ">Cancel</button>
        `;
        
        document.getElementById('submitAssignmentBtn').addEventListener('click', () => {
            this.showSubmitAssignmentModal();
        });
        
        document.getElementById('cancelAssignmentBtn').addEventListener('click', () => {
            this.currentAssignmentId = null;
            notification.remove();
        });
    }
    
    showSubmitAssignmentModal() {
        if (!this.currentAssignmentId) {
            alert('No assignment selected');
            return;
        }
        
        if (this.elements.length === 0) {
            alert('Please create a mind map before submitting.');
            return;
        }
        
        const modal = document.getElementById('submitAssignmentModal');
        document.getElementById('submitAssignmentError').style.display = 'none';
        modal.style.display = 'flex';
    }
    
    async submitAssignmentMindmap() {
        const modal = document.getElementById('submitAssignmentModal');
        const errorEl = document.getElementById('submitAssignmentError');
        const confirmBtn = document.getElementById('confirmAssignmentSubmit');
        
        errorEl.style.display = 'none';
        
        if (!this.currentAssignmentId) {
            errorEl.textContent = 'No assignment selected';
            errorEl.style.display = 'block';
            return;
        }
        
        try {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Submitting...';
            
            // Prepare data with embedded images
            const data = {
                elements: this.elements.map(el => {
                    const copy = { ...el };
                    // Keep embedded images as-is
                    return copy;
                }),
                connections: this.connections,
                panOffset: this.panOffset,
                zoom: this.zoom
            };
            
            await FirebaseService.submitAssignmentMindmap(this.currentAssignmentId, data);
            
            modal.style.display = 'none';
            
            // Remove notification
            const notification = document.getElementById('assignmentNotification');
            if (notification) notification.remove();
            
            this.currentAssignmentId = null;
            
            alert('✅ Mind map submitted successfully! Your teacher will grade it.');
            
        } catch (error) {
            console.error('Submit error:', error);
            errorEl.textContent = 'Failed to submit: ' + error.message;
            errorEl.style.display = 'block';
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Submit My Mind Map';
        }
    }
    
    // Admin: Show assignments management panel
    async showAdminAssignmentsPanel() {
        const panel = document.getElementById('adminAssignmentsPanel');
        const list = document.getElementById('adminAssignmentsList');
        
        panel.style.display = 'flex';
        list.innerHTML = '<p>Loading assignments...</p>';
        
        try {
            const assignments = await FirebaseService.getAllAssignments();
            
            if (assignments.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">📋</div>
                        <h4>No Assignments</h4>
                        <p>Click "Create Assignment" to create your first assignment.</p>
                    </div>
                `;
                return;
            }
            
            list.innerHTML = assignments.map(a => {
                const isActive = a.status === 'active';
                const isCompleted = a.status === 'completed';
                
                return `
                    <div class="assignment-card ${a.status}">
                        <div style="display: flex; justify-content: space-between; align-items: start;">
                            <div>
                                <h4>${a.topic}</h4>
                                <div class="levels">
                                    ${a.levels.map(l => `<span class="level-badge">${l}</span>`).join('')}
                                </div>
                                <div class="prize">🎁 ${a.prize}</div>
                                <div class="deadline">⏰ ${a.deadline ? a.deadline.toLocaleString() : 'No deadline'}</div>
                                <span class="status-badge ${a.status}">${a.status.toUpperCase()}</span>
                                ${isCompleted && a.winnerName ? `<div style="margin-top: 8px; color: #28a745;">🏆 Winner: ${a.winnerName} (${a.winnerScore}/100)</div>` : ''}
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <button class="action-btn view-submissions-btn" data-id="${a.id}">View Submissions</button>
                                ${isActive ? `<button class="action-btn edit-assignment-btn" data-id="${a.id}">Edit</button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Click handlers
            list.querySelectorAll('.view-submissions-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const assignment = assignments.find(a => a.id === btn.dataset.id);
                    this.showSubmissionsModal(assignment);
                });
            });
            
            list.querySelectorAll('.edit-assignment-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const assignment = assignments.find(a => a.id === btn.dataset.id);
                    this.showAssignmentForm(assignment);
                });
            });
            
        } catch (error) {
            console.error('Load admin assignments error:', error);
            list.innerHTML = '<p>Failed to load assignments.</p>';
        }
    }
    
    // Admin: Show assignment form (create/edit)
    showAssignmentForm(assignment = null) {
        const modal = document.getElementById('assignmentFormModal');
        const title = document.getElementById('assignmentFormTitle');
        const editingId = document.getElementById('editingAssignmentId');
        const topic = document.getElementById('assignmentTopic');
        const description = document.getElementById('assignmentDescription');
        const prize = document.getElementById('assignmentPrize');
        const deadline = document.getElementById('assignmentDeadline');
        const errorEl = document.getElementById('assignmentFormError');
        
        errorEl.style.display = 'none';
        
        if (assignment) {
            title.textContent = 'Edit Assignment';
            editingId.value = assignment.id;
            topic.value = assignment.topic || '';
            description.value = assignment.description || '';
            prize.value = assignment.prize || '';
            
            // Format deadline for datetime-local input
            if (assignment.deadline) {
                const d = assignment.deadline;
                deadline.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            } else {
                deadline.value = '';
            }
            
            // Set level checkboxes
            document.querySelectorAll('#assignmentLevels input').forEach(cb => {
                cb.checked = assignment.levels && assignment.levels.includes(cb.value);
            });
        } else {
            title.textContent = 'Create Assignment';
            editingId.value = '';
            topic.value = '';
            description.value = '';
            prize.value = '';
            deadline.value = '';
            document.querySelectorAll('#assignmentLevels input').forEach(cb => cb.checked = false);
        }
        
        modal.style.display = 'flex';
    }
    
    async saveAssignmentForm() {
        const modal = document.getElementById('assignmentFormModal');
        const editingId = document.getElementById('editingAssignmentId').value;
        const topic = document.getElementById('assignmentTopic').value.trim();
        const description = document.getElementById('assignmentDescription').value.trim();
        const prize = document.getElementById('assignmentPrize').value.trim();
        const deadline = document.getElementById('assignmentDeadline').value;
        const errorEl = document.getElementById('assignmentFormError');
        const saveBtn = document.getElementById('saveAssignment');
        
        // Get selected levels
        const levels = Array.from(document.querySelectorAll('#assignmentLevels input:checked')).map(cb => cb.value);
        
        errorEl.style.display = 'none';
        
        if (!topic) {
            errorEl.textContent = 'Please enter a topic';
            errorEl.style.display = 'block';
            return;
        }
        if (levels.length === 0) {
            errorEl.textContent = 'Please select at least one level';
            errorEl.style.display = 'block';
            return;
        }
        if (!prize) {
            errorEl.textContent = 'Please enter a prize';
            errorEl.style.display = 'block';
            return;
        }
        if (!deadline) {
            errorEl.textContent = 'Please set a deadline';
            errorEl.style.display = 'block';
            return;
        }
        
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            const data = {
                topic,
                description,
                levels,
                prize,
                deadline
            };
            
            if (editingId) {
                await FirebaseService.updateAssignment(editingId, data);
            } else {
                await FirebaseService.createAssignment(data);
            }
            
            modal.style.display = 'none';
            this.showAdminAssignmentsPanel(); // Refresh list
            
        } catch (error) {
            console.error('Save assignment error:', error);
            errorEl.textContent = 'Failed to save: ' + error.message;
            errorEl.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Assignment';
        }
    }
    
    // Admin: Show submissions for an assignment
    async showSubmissionsModal(assignment) {
        this.currentViewingAssignment = assignment;
        
        const modal = document.getElementById('viewSubmissionsModal');
        const title = document.getElementById('submissionsAssignmentTitle');
        const list = document.getElementById('submissionsList');
        const closeBtn = document.getElementById('closeAssignmentBtn');
        
        title.textContent = `Submissions: ${assignment.topic}`;
        closeBtn.style.display = assignment.status === 'active' ? 'inline-block' : 'none';
        
        list.innerHTML = '<p>Loading submissions...</p>';
        modal.style.display = 'flex';
        
        try {
            const submissions = await FirebaseService.getAssignmentSubmissions(assignment.id);
            
            if (submissions.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">📭</div>
                        <h4>No Submissions Yet</h4>
                        <p>Students haven't submitted any mind maps for this assignment yet.</p>
                    </div>
                `;
                return;
            }
            
            list.innerHTML = submissions.map(s => `
                <div class="submission-card" data-id="${s.id}">
                    <div class="thumbnail">
                        ${s.thumbnail ? `<img src="${s.thumbnail}" alt="Preview">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;">No preview</div>'}
                    </div>
                    <div class="info">
                        <div class="student-name">${s.studentName || 'Unknown'}</div>
                        <div class="meta">${s.level} · ${s.userEmail}</div>
                        <div class="meta">Submitted: ${s.submittedAt ? s.submittedAt.toLocaleString() : ''}</div>
                    </div>
                    <div class="score ${s.score === null ? 'not-graded' : ''}">
                        ${s.score !== null ? s.score : 'Not graded'}
                    </div>
                    <div class="actions">
                        <button class="action-btn view-btn" data-id="${s.id}">View</button>
                        <button class="action-btn primary grade-btn" data-id="${s.id}">Grade</button>
                    </div>
                </div>
            `).join('');
            
            // Store submissions for reference
            this.currentSubmissions = submissions;
            
            // Click handlers
            list.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const submission = submissions.find(s => s.id === btn.dataset.id);
                    try {
                        const fullSubmission = await FirebaseService.loadAssignmentSubmission(submission.id);
                        this.loadMindmapData(fullSubmission.data);
                        modal.style.display = 'none';
                    } catch (error) {
                        console.error('Load submission error:', error);
                        alert('Failed to load submission');
                    }
                });
            });
            
            list.querySelectorAll('.grade-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const submission = submissions.find(s => s.id === btn.dataset.id);
                    this.showGradeModal(submission);
                });
            });
            
        } catch (error) {
            console.error('Load submissions error:', error);
            list.innerHTML = '<p>Failed to load submissions.</p>';
        }
    }
    
    // Admin: Show grade modal
    showGradeModal(submission) {
        const modal = document.getElementById('gradeModal');
        const submissionId = document.getElementById('gradingSubmissionId');
        const studentInfo = document.getElementById('gradingStudentInfo');
        const scoreInput = document.getElementById('gradeScore');
        const feedbackInput = document.getElementById('gradeFeedback');
        const errorEl = document.getElementById('gradeError');
        
        submissionId.value = submission.id;
        studentInfo.textContent = `Student: ${submission.studentName} (${submission.level})`;
        scoreInput.value = submission.score || '';
        feedbackInput.value = submission.feedback || '';
        errorEl.style.display = 'none';
        
        modal.style.display = 'flex';
    }
    
    async saveGradeForm() {
        const modal = document.getElementById('gradeModal');
        const submissionId = document.getElementById('gradingSubmissionId').value;
        const score = parseInt(document.getElementById('gradeScore').value);
        const feedback = document.getElementById('gradeFeedback').value.trim();
        const errorEl = document.getElementById('gradeError');
        const saveBtn = document.getElementById('saveGrade');
        
        errorEl.style.display = 'none';
        
        if (isNaN(score) || score < 0 || score > 100) {
            errorEl.textContent = 'Please enter a score between 0 and 100';
            errorEl.style.display = 'block';
            return;
        }
        
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            await FirebaseService.gradeSubmission(submissionId, score, feedback);
            
            modal.style.display = 'none';
            
            // Refresh submissions list
            if (this.currentViewingAssignment) {
                this.showSubmissionsModal(this.currentViewingAssignment);
            }
            
        } catch (error) {
            console.error('Save grade error:', error);
            errorEl.textContent = 'Failed to save grade: ' + error.message;
            errorEl.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Grade';
        }
    }
    
    // Admin: Close assignment and determine winner
    async closeAssignmentAndPickWinner() {
        if (!this.currentViewingAssignment) return;
        
        const confirmClose = confirm(
            'Are you sure you want to close this assignment and determine the winner?\n\n' +
            'This action cannot be undone. The student with the highest score will be declared the winner.'
        );
        
        if (!confirmClose) return;
        
        try {
            const result = await FirebaseService.closeAssignmentAndDetermineWinner(this.currentViewingAssignment.id);
            
            document.getElementById('viewSubmissionsModal').style.display = 'none';
            
            // Show winner modal
            this.showWinnerModal(result);
            
            // Refresh admin panel
            this.showAdminAssignmentsPanel();
            
        } catch (error) {
            console.error('Close assignment error:', error);
            alert('Failed to close assignment: ' + error.message);
        }
    }
    
    // Show winner announcement
    showWinnerModal(result) {
        const modal = document.getElementById('winnerModal');
        const details = document.getElementById('winnerDetails');
        
        if (result.winner) {
            details.innerHTML = `
                <div class="winner-name">🎉 ${result.winner.studentName}</div>
                <div class="winner-score">Score: ${result.winner.score}/100</div>
                <div class="winner-prize">
                    <strong>Prize:</strong> ${result.assignment.prize}
                </div>
                <div class="winner-address">
                    <h4>📬 Delivery Address:</h4>
                    <p>${result.winner.address || 'No address provided'}</p>
                </div>
            `;
        } else {
            details.innerHTML = `
                <p>No submissions were graded for this assignment.</p>
            `;
        }
        
        modal.style.display = 'flex';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.mindmapApp = new MindmapApp();
});

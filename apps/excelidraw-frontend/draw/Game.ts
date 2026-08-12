import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

type Shape = {
    id: string;
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
} | {
    id: string;
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
    color?: string;
} | {
    id: string;
    type: "pencil";
    points: {
        x: number;
        y: number;
    }[];
    color?: string;
} | {
    id: string;
    type: "line";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color?: string;
} | {
    id: string;
    type: "diamond";
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
} | {
    id: string;
    type: "arrow";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color?: string;
}

// draws a line plus a small angled arrowhead at the end point
function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const headLength = 12;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

// shortest distance from point (x, y) to the line segment (x1,y1)-(x2,y2)
function distToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        return Math.hypot(x - x1, y - y1);
    }

    let t = ((x - x1) * dx + (y - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    return Math.hypot(x - closestX, y - closestY);
}

// nudges a shape's coordinates by (dx, dy) in place, used while dragging
function translateShape(shape: Shape, dx: number, dy: number) {
    if (shape.type === "rect" || shape.type === "diamond") {
        shape.x += dx;
        shape.y += dy;
    } else if (shape.type === "circle") {
        shape.centerX += dx;
        shape.centerY += dy;
    } else if (shape.type === "line" || shape.type === "arrow") {
        shape.x1 += dx;
        shape.y1 += dy;
        shape.x2 += dx;
        shape.y2 += dy;
    } else if (shape.type === "pencil") {
        shape.points = shape.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }
}

export class Game {

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[]
    private roomId: string;
    private clicked: boolean;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = "circle";
    private pencilPoints: { x: number; y: number }[] = [];
    private offsetX = 0;
    private offsetY = 0;
    private scale = 1;
    private panning = false;
    private panStartX = 0;
    private panStartY = 0;
    private strokeColor = "#ffffff";
    private draggingShape: Shape | null = null;
    private erasedThisStroke = new Set<string>();

    socket: WebSocket;

    constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket, onReady?: () => void) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.existingShapes = [];
        this.roomId = roomId;
        this.socket = socket;
        this.clicked = false;
        this.init().then(() => onReady?.());
        this.initHandlers();
        this.initMouseHandlers();
    }
    
    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler)

        this.canvas.removeEventListener("mouseup", this.mouseUpHandler)

        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler)

        this.canvas.removeEventListener("wheel", this.wheelHandler)
    }

    setTool(tool: Tool) {
        this.selectedTool = tool;
    }

    setStrokeColor(color: string) {
        this.strokeColor = color;
    }

    clearAll() {
        this.existingShapes = [];
        this.clearCanvas();
        this.socket.send(JSON.stringify({
            type: "clear",
            roomId: this.roomId
        }));
    }

    toWorldX(clientX: number) {
        return (clientX - this.offsetX) / this.scale;
    }

    toWorldY(clientY: number) {
        return (clientY - this.offsetY) / this.scale;
    }

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId);
        console.log(this.existingShapes);
        this.clearCanvas();
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type == "chat") {
                const parsedShape = JSON.parse(message.message)
                this.existingShapes.push(parsedShape.shape)
                this.clearCanvas();
            }

            if (message.type === "clear") {
                this.existingShapes = [];
                this.clearCanvas();
            }

            if (message.type === "update") {
                const idx = this.existingShapes.findIndex(s => s.id === message.id);
                if (idx !== -1) {
                    this.existingShapes[idx] = message.shape;
                }
                this.clearCanvas();
            }

            if (message.type === "delete") {
                this.existingShapes = this.existingShapes.filter(s => s.id !== message.id);
                this.clearCanvas();
            }
        }
    }

    // finds the topmost shape under a world-space point, or null if nothing's there.
    // used by both the select tool (to grab a shape) and the eraser (to know what to delete)
    hitTest(x: number, y: number): Shape | null {
        for (let i = this.existingShapes.length - 1; i >= 0; i--) {
            const shape = this.existingShapes[i];

            if (shape.type === "rect" || shape.type === "diamond") {
                const x1 = Math.min(shape.x, shape.x + shape.width);
                const x2 = Math.max(shape.x, shape.x + shape.width);
                const y1 = Math.min(shape.y, shape.y + shape.height);
                const y2 = Math.max(shape.y, shape.y + shape.height);
                if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
                    return shape;
                }
            } else if (shape.type === "circle") {
                const dist = Math.hypot(x - shape.centerX, y - shape.centerY);
                if (dist <= Math.abs(shape.radius) + 5) {
                    return shape;
                }
            } else if (shape.type === "line" || shape.type === "arrow") {
                if (distToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= 6) {
                    return shape;
                }
            } else if (shape.type === "pencil") {
                for (let j = 0; j < shape.points.length - 1; j++) {
                    const p1 = shape.points[j];
                    const p2 = shape.points[j + 1];
                    if (distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= 6) {
                        return shape;
                    }
                }
            }
        }
        return null;
    }

    clearCanvas() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0)"
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // everything below is drawn in "world space" so panning/zooming
        // just moves the camera instead of touching each shape's coordinates
        this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

        this.existingShapes.map((shape) => {
            if (shape.type === "rect") {
                this.ctx.strokeStyle = shape.color ?? "#ffffff"
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            } else if (shape.type === "circle") {
                this.ctx.strokeStyle = shape.color ?? "#ffffff"
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();                
            } else if (shape.type === "pencil") {
                if (shape.points.length < 2) {
                    return;
                }
                this.ctx.strokeStyle = shape.color ?? "#ffffff"
                this.ctx.beginPath();
                this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
                for (let i = 1; i < shape.points.length; i++) {
                    this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "line") {
                this.ctx.strokeStyle = shape.color ?? "#ffffff"
                this.ctx.beginPath();
                this.ctx.moveTo(shape.x1, shape.y1);
                this.ctx.lineTo(shape.x2, shape.y2);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (shape.type === "diamond") {
                this.ctx.strokeStyle = shape.color ?? "#ffffff"
                const cx = shape.x + shape.width / 2;
                const cy = shape.y + shape.height / 2;
                this.ctx.beginPath();
                this.ctx.moveTo(cx, shape.y);
                this.ctx.lineTo(shape.x + shape.width, cy);
                this.ctx.lineTo(cx, shape.y + shape.height);
                this.ctx.lineTo(shape.x, cy);
                this.ctx.closePath();
                this.ctx.stroke();
            } else if (shape.type === "arrow") {
                this.ctx.strokeStyle = shape.color ?? "#ffffff"
                drawArrow(this.ctx, shape.x1, shape.y1, shape.x2, shape.y2);
            }
        })
    }

    mouseDownHandler = (e) => {
        if (e.button === 1) {
            this.panning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            return;
        }

        this.clicked = true
        this.startX = this.toWorldX(e.clientX)
        this.startY = this.toWorldY(e.clientY)

        if (this.selectedTool === "pencil") {
            this.pencilPoints = [{ x: this.startX, y: this.startY }];
        }

        if (this.selectedTool === "select") {
            this.draggingShape = this.hitTest(this.startX, this.startY);
        }

        if (this.selectedTool === "eraser") {
            const hit = this.hitTest(this.startX, this.startY);
            if (hit) {
                this.erasedThisStroke.add(hit.id);
                this.existingShapes = this.existingShapes.filter(s => s.id !== hit.id);
                this.clearCanvas();
                this.socket.send(JSON.stringify({
                    type: "delete",
                    id: hit.id,
                    roomId: this.roomId
                }));
            }
        }
    }
    mouseUpHandler = (e) => {
        if (this.panning) {
            this.panning = false;
            return;
        }

        this.clicked = false
        this.erasedThisStroke.clear();

        if (this.selectedTool === "select") {
            if (this.draggingShape) {
                this.socket.send(JSON.stringify({
                    type: "update",
                    id: this.draggingShape.id,
                    shape: this.draggingShape,
                    roomId: this.roomId
                }));
            }
            this.draggingShape = null;
            return;
        }

        if (this.selectedTool === "eraser") {
            return;
        }

        const currentX = this.toWorldX(e.clientX);
        const currentY = this.toWorldY(e.clientY);
        const width = currentX - this.startX;
        const height = currentY - this.startY;

        const selectedTool = this.selectedTool;
        let shape: Shape | null = null;
        if (selectedTool === "rect") {

            shape = {
                id: crypto.randomUUID(),
                type: "rect",
                x: this.startX,
                y: this.startY,
                height,
                width,
                color: this.strokeColor
            }
        } else if (selectedTool === "circle") {
            const radius = Math.max(width, height) / 2;
            shape = {
                id: crypto.randomUUID(),
                type: "circle",
                radius: radius,
                centerX: this.startX + radius,
                centerY: this.startY + radius,
                color: this.strokeColor
            }
        } else if (selectedTool === "pencil") {
            if (this.pencilPoints.length < 2) {
                this.pencilPoints = [];
                return;
            }
            shape = {
                id: crypto.randomUUID(),
                type: "pencil",
                points: this.pencilPoints,
                color: this.strokeColor
            }
            this.pencilPoints = [];
        } else if (selectedTool === "line") {
            shape = {
                id: crypto.randomUUID(),
                type: "line",
                x1: this.startX,
                y1: this.startY,
                x2: currentX,
                y2: currentY,
                color: this.strokeColor
            }
        } else if (selectedTool === "diamond") {
            shape = {
                id: crypto.randomUUID(),
                type: "diamond",
                x: this.startX,
                y: this.startY,
                width,
                height,
                color: this.strokeColor
            }
        } else if (selectedTool === "arrow") {
            shape = {
                id: crypto.randomUUID(),
                type: "arrow",
                x1: this.startX,
                y1: this.startY,
                x2: currentX,
                y2: currentY,
                color: this.strokeColor
            }
        }

        if (!shape) {
            return;
        }

        this.existingShapes.push(shape);

        this.socket.send(JSON.stringify({
            type: "chat",
            message: JSON.stringify({
                shape
            }),
            roomId: this.roomId
        }))
    }
    mouseMoveHandler = (e) => {
        if (this.panning) {
            this.offsetX += e.clientX - this.panStartX;
            this.offsetY += e.clientY - this.panStartY;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.clearCanvas();
            return;
        }

        const currentX = this.toWorldX(e.clientX);
        const currentY = this.toWorldY(e.clientY);

        if (this.selectedTool === "select" && this.clicked && this.draggingShape) {
            const dx = currentX - this.startX;
            const dy = currentY - this.startY;
            translateShape(this.draggingShape, dx, dy);
            this.startX = currentX;
            this.startY = currentY;
            this.clearCanvas();
            return;
        }

        if (this.selectedTool === "eraser" && this.clicked) {
            const hit = this.hitTest(currentX, currentY);
            if (hit && !this.erasedThisStroke.has(hit.id)) {
                this.erasedThisStroke.add(hit.id);
                this.existingShapes = this.existingShapes.filter(s => s.id !== hit.id);
                this.clearCanvas();
                this.socket.send(JSON.stringify({
                    type: "delete",
                    id: hit.id,
                    roomId: this.roomId
                }));
            }
            return;
        }

        if (this.clicked) {
            const width = currentX - this.startX;
            const height = currentY - this.startY;
            this.clearCanvas();
            this.ctx.strokeStyle = this.strokeColor
            const selectedTool = this.selectedTool;
            if (selectedTool === "rect") {
                this.ctx.strokeRect(this.startX, this.startY, width, height);   
            } else if (selectedTool === "circle") {
                const radius = Math.max(width, height) / 2;
                const centerX = this.startX + radius;
                const centerY = this.startY + radius;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, Math.abs(radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();                
            } else if (selectedTool === "pencil") {
                this.pencilPoints.push({ x: currentX, y: currentY });

                this.ctx.beginPath();
                this.ctx.moveTo(this.pencilPoints[0].x, this.pencilPoints[0].y);
                for (let i = 1; i < this.pencilPoints.length; i++) {
                    this.ctx.lineTo(this.pencilPoints[i].x, this.pencilPoints[i].y);
                }
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (selectedTool === "line") {
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(currentX, currentY);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (selectedTool === "diamond") {
                const cx = this.startX + width / 2;
                const cy = this.startY + height / 2;
                this.ctx.beginPath();
                this.ctx.moveTo(cx, this.startY);
                this.ctx.lineTo(this.startX + width, cy);
                this.ctx.lineTo(cx, this.startY + height);
                this.ctx.lineTo(this.startX, cy);
                this.ctx.closePath();
                this.ctx.stroke();
            } else if (selectedTool === "arrow") {
                drawArrow(this.ctx, this.startX, this.startY, currentX, currentY);
            }
        }
    }

    wheelHandler = (e) => {
        e.preventDefault();

        if (e.ctrlKey) {
            // pinch-to-zoom on trackpads, or ctrl + scroll wheel
            const zoomIntensity = 0.01;
            const newScale = this.scale * (1 - e.deltaY * zoomIntensity);
            const clampedScale = Math.min(Math.max(newScale, 0.1), 5);

            // keep whatever point is under the cursor fixed in place while zooming
            const worldX = this.toWorldX(e.clientX);
            const worldY = this.toWorldY(e.clientY);

            this.scale = clampedScale;
            this.offsetX = e.clientX - worldX * this.scale;
            this.offsetY = e.clientY - worldY * this.scale;
        } else {
            // two finger trackpad scroll (or a normal mouse wheel) pans the canvas
            this.offsetX -= e.deltaX;
            this.offsetY -= e.deltaY;
        }

        this.clearCanvas();
    }

    initMouseHandlers() {
        this.canvas.addEventListener("mousedown", this.mouseDownHandler)

        this.canvas.addEventListener("mouseup", this.mouseUpHandler)

        this.canvas.addEventListener("mousemove", this.mouseMoveHandler)    

        this.canvas.addEventListener("wheel", this.wheelHandler, { passive: false })

    }
}

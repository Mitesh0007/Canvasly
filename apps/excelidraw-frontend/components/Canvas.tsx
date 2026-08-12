import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon, Trash2, Minus, Diamond, MoveUpRight, MousePointer2, Eraser } from "lucide-react";
import { Game } from "@/draw/Game";

export type Tool = "circle" | "rect" | "pencil" | "line" | "diamond" | "arrow" | "select" | "eraser";

export function Canvas({
    roomId,
    socket
}: {
    socket: WebSocket;
    roomId: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [game, setGame] = useState<Game>();
    const [selectedTool, setSelectedTool] = useState<Tool>("circle")
    const [selectedColor, setSelectedColor] = useState("#ffffff");
    const [loading, setLoading] = useState(true);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        function updateDimensions() {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        }

        updateDimensions();
        window.addEventListener("resize", updateDimensions);

        return () => {
            window.removeEventListener("resize", updateDimensions);
        }
    }, []);

    useEffect(() => {
        game?.clearCanvas();
    }, [dimensions, game]);

    useEffect(() => {
        game?.setTool(selectedTool);
    }, [selectedTool, game]);

    useEffect(() => {

        if (canvasRef.current) {
            const g = new Game(canvasRef.current, roomId, socket, () => setLoading(false));
            setGame(g);

            return () => {
                g.destroy();
            }
        }


    }, [canvasRef]);

    return <div style={{
        height: "100vh",
        overflow: "hidden"
    }}>
        <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height}></canvas>
        {loading && <div style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none"
        }}>
            <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
        </div>}
        <Topbar
            setSelectedTool={setSelectedTool}
            selectedTool={selectedTool}
            selectedColor={selectedColor}
            setSelectedColor={(c) => { setSelectedColor(c); game?.setStrokeColor(c); }}
            onClear={() => game?.clearAll()}
        />
    </div>
}

const COLORS = ["#ffffff", "#f87171", "#4ade80", "#60a5fa", "#facc15"];

function Topbar({selectedTool, setSelectedTool, selectedColor, setSelectedColor, onClear}: {
    selectedTool: Tool,
    setSelectedTool: (s: Tool) => void,
    selectedColor: string,
    setSelectedColor: (c: string) => void,
    onClear: () => void
}) {
    return <div style={{
            position: "fixed",
            top: 10,
            left: 10
        }}>
            <div className="flex gap-t">
                <IconButton
                    onClick={() => {
                        setSelectedTool("select")
                    }}
                    activated={selectedTool === "select"}
                    icon={<MousePointer2 />}
                />
                <IconButton 
                    onClick={() => {
                        setSelectedTool("pencil")
                    }}
                    activated={selectedTool === "pencil"}
                    icon={<Pencil />}
                />
                <IconButton onClick={() => {
                    setSelectedTool("rect")
                }} activated={selectedTool === "rect"} icon={<RectangleHorizontalIcon />} ></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("circle")
                }} activated={selectedTool === "circle"} icon={<Circle />}></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("line")
                }} activated={selectedTool === "line"} icon={<Minus />}></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("diamond")
                }} activated={selectedTool === "diamond"} icon={<Diamond />}></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("arrow")
                }} activated={selectedTool === "arrow"} icon={<MoveUpRight />}></IconButton>
                <IconButton onClick={() => {
                    setSelectedTool("eraser")
                }} activated={selectedTool === "eraser"} icon={<Eraser />}></IconButton>
                <IconButton onClick={onClear} activated={false} icon={<Trash2 />}></IconButton>
            </div>
            <div className="flex gap-t mt-1">
                {COLORS.map((c) => (
                    <div
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        className={`m-2 rounded-full border-2 cursor-pointer ${selectedColor === c ? "border-red-400" : "border-transparent"}`}
                        style={{ width: 20, height: 20, backgroundColor: c }}
                    />
                ))}
            </div>
        </div>
}
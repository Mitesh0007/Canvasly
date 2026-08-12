"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { HTTP_BACKEND } from "@/config";

export default function RoomPage() {
    const router = useRouter();
    const [roomName, setRoomName] = useState("");

    async function handleJoin() {
        const token = localStorage.getItem("token");

        if (!token) {
            router.push("/signin");
            return;
        }

        try {
            const existingRoom = await axios.get(`${HTTP_BACKEND}/room/${roomName}`);

            if (existingRoom.data.room) {
                router.push(`/canvas/${existingRoom.data.room.id}`);
                return;
            }

            const createdRoom = await axios.post(`${HTTP_BACKEND}/room`, {
                name: roomName
            }, {
                headers: {
                    authorization: token
                }
            });

            router.push(`/canvas/${createdRoom.data.roomId}`);
        } catch(e) {
            alert("Something went wrong, please try again");
            console.log(e);
        }
    }

    return <div className="w-screen h-screen flex justify-center items-center">
        <div className="p-6 m-2 bg-white rounded">
            <div className="p-2">
                <input type="text" placeholder="Room name" onChange={(e) => {
                    setRoomName(e.target.value)
                }}></input>
            </div>

            <div className="pt-2">
                <button className="bg-red-200 rounded p-2" onClick={handleJoin}>Join / Create room</button>
            </div>
        </div>
    </div>
}

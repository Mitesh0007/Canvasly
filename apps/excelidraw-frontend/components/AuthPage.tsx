"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { HTTP_BACKEND } from "@/config";

export function AuthPage({isSignin}: {
    isSignin: boolean
}) {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    async function handleSubmit() {
        try {
            if (isSignin) {
                const res = await axios.post(`${HTTP_BACKEND}/signin`, {
                    username,
                    password
                });

                localStorage.setItem("token", res.data.token);
                router.push("/room");
            } else {
                await axios.post(`${HTTP_BACKEND}/signup`, {
                    username,
                    password,
                    name
                });

                router.push("/signin");
            }
        } catch(e) {
            alert("Something went wrong, please try again");
            console.log(e);
        }
    }

    return <div className="w-screen h-screen flex justify-center items-center">
        <div className="p-6 m-2 bg-white rounded">
            <div className="p-2">
                <input type="text" placeholder="Email" onChange={(e) => {
                    setUsername(e.target.value)
                }}></input>
            </div>
            {!isSignin && <div className="p-2">
                <input type="text" placeholder="Name" onChange={(e) => {
                    setName(e.target.value)
                }}></input>
            </div>}
            <div className="p-2">
                <input type="password" placeholder="Password" onChange={(e) => {
                    setPassword(e.target.value)
                }}></input>
            </div>

            <div className="pt-2">
                <button className="bg-red-200 rounded p-2" onClick={handleSubmit}>{isSignin ? "Sign in" : "Sign up"}</button>
            </div>
        </div>
    </div>

}

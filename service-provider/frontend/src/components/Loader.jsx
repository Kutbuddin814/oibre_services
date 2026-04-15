import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function Loader({ text = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      
      <DotLottieReact
        src="https://lottie.host/6fa1a899-d8e9-44c5-b08e-7ede3bcb7adf/xbcOg7nIzQ.lottie"
        loop
        autoplay
        style={{ width: "220px", height: "220px" }}
      />

      <p className="mt-4 text-slate-500 text-sm animate-pulse">
        {text}
      </p>
    </div>
  );
}
import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function Loader({ text = "Loading..." }) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <DotLottieReact
        src="https://lottie.host/6fa1a899-d8e9-44c5-b08e-7ede3bcb7adf/xbcOg7nIzQ.lottie"
        loop
        autoplay
        style={{ width: "200px", height: "200px" }}
      />

      <p
        style={{
          marginTop: "10px",
          fontSize: "14px",
          color: "#6b7280"
        }}
      >
        {text}
      </p>
    </div>
  );
}
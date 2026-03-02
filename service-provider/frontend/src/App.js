import { useState } from "react";
import SplashScreen from "./components/SplashScreen";
import ProviderRegister from "./components/ProviderRegister";
import SubmissionPending from "./components/SubmissionPending";

function App() {
  const [step, setStep] = useState("splash");

  if (step === "splash") {
    return <SplashScreen onStart={() => setStep("form")} />;
  }

  if (step === "form") {
    return <ProviderRegister onSuccess={() => setStep("submitted")} />;
  }

  if (step === "submitted") {
    return <SubmissionPending />;
  }

  return null;
}

export default App;

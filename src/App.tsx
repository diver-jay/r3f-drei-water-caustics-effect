import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import NowPage from "./pages/NowPage";
import UsesPage from "./pages/UsesPage";
import PlaygroundPage from "./pages/PlaygroundPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/now" element={<NowPage />} />
        <Route path="/uses" element={<UsesPage />} />
        <Route path="/playground" element={<PlaygroundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

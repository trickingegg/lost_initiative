import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainMenuScreen from "./components/MainMenuScreen";
import AdventureSetupScreen from "./components/AdventureSetupScreen";
import CharacterCreationScreen from "./components/CharacterCreationScreen";
import GameScreen from "./components/GameScreen";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainMenuScreen />} />
        <Route path="/setup" element={<AdventureSetupScreen />} />
        <Route path="/create" element={<CharacterCreationScreen />} />
        <Route path="/game" element={<GameScreen />} />
      </Routes>
    </BrowserRouter>
  );
}

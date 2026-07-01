import { useNavigate } from "react-router-dom";

export default function MainMenuScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <h1
          className="text-5xl font-bold text-amber-400 mb-2"
          style={{ fontFamily: "serif", letterSpacing: "0.1em" }}
        >
          AI Game Master
        </h1>
        <p className="text-gray-400 mb-12">Your adventure awaits.</p>

        <div className="space-y-4">
          <button
            onClick={() => navigate("/create")}
            className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-4 px-6 rounded-md transition text-xl"
          >
            New Game
          </button>
          <button
            onClick={() => navigate("/setup")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-md transition text-xl"
          >
            Continue Setup
          </button>
        </div>
      </div>
    </div>
  );
}

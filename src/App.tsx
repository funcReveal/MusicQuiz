import "./styles/App.css";
import RoomChatPage from "./pages/RoomChatPage/RoomChatPage";

function App() {
  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 justify-center items-start p-4">
      {/* <div className="w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-xl shadow-xl p-4"> */}
      <RoomChatPage />
      {/* </div> */}
    </div>
  );
}

export default App;

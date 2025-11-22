import ReactDOM from "react-dom/client";
import MainPage from "./App.tsx";
import "./styles/index.scss";

const App = () => <MainPage />;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

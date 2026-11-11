import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/fonts.css";
import "./styles/theme.css";
import "./styles/pages.css";
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: false };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error) {
    console.error("Original Set rendering error", error);
  }
  render() {
    return this.state.error ? (
      <main className="page-width page-main">
        <h1>A pause in play.</h1>
        <p>The page could not be displayed. Reload to try again.</p>
        <button className="button" onClick={() => location.reload()}>
          Reload the collection
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <Boundary>
    <App />
  </Boundary>,
);

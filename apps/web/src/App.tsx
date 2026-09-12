import { Route, Routes } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { CVPage } from "./routes/CVPage";
import { NotFoundPage } from "./routes/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="cv" element={<CVPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

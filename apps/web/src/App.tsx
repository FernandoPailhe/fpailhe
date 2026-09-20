import { Route, Routes } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { CVPage } from "./routes/CVPage";
import { ProjectDetailPage } from "./routes/ProjectDetailPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { TryMatePage } from "./lab/trymate";

export function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="cv" element={<CVPage />} />
      <Route path="projects/:projectId" element={<ProjectDetailPage />} />
      <Route path="lab/trymate" element={<TryMatePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

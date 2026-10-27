import { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { CVPage } from "./routes/CVPage";
import { ProjectDetailPage } from "./routes/ProjectDetailPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { TryMatePage } from "./lab/trymate";
import {
  UniverseEndPage,
  UniversePage,
  UniversePlayPage,
  UniversesIndexPage,
  UniversesLayout,
} from "./lab/universes";

const loading = <p>Cargando…</p>;

export function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="cv" element={<CVPage />} />
      <Route path="projects/:projectId" element={<ProjectDetailPage />} />
      <Route path="lab/trymate" element={<TryMatePage />} />
      <Route
        path="lab/universes"
        element={<Suspense fallback={loading}>{<UniversesLayout />}</Suspense>}
      >
        <Route
          index
          element={<Suspense fallback={loading}>{<UniversesIndexPage />}</Suspense>}
        />
        <Route
          path=":slug"
          element={<Suspense fallback={loading}>{<UniversePage />}</Suspense>}
        />
        <Route
          path=":slug/jugar"
          element={<Suspense fallback={loading}>{<UniversePlayPage />}</Suspense>}
        />
        <Route
          path=":slug/final"
          element={<Suspense fallback={loading}>{<UniverseEndPage />}</Suspense>}
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

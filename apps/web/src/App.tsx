import { Route, Routes } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { NotFoundPage } from "./routes/NotFoundPage";

/**
 * TEMPLATE: Agregá tus rutas acá. Para layouts anidados,
 * creá un componente layout con <Outlet /> y usalo como
 * elemento de una Route padre.
 */
export function App() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

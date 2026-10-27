import { lazy } from "react";

export const UniversesLayout = lazy(() =>
  import("./components/UniversesLayout").then((m) => ({ default: m.UniversesLayout })),
);
export const UniversesIndexPage = lazy(() =>
  import("./routes/UniversesIndexPage").then((m) => ({ default: m.UniversesIndexPage })),
);
export const UniversePage = lazy(() =>
  import("./routes/UniversePage").then((m) => ({ default: m.UniversePage })),
);
export const UniversePlayPage = lazy(() =>
  import("./routes/UniversePlayPage").then((m) => ({ default: m.UniversePlayPage })),
);
export const UniverseEndPage = lazy(() =>
  import("./routes/UniverseEndPage").then((m) => ({ default: m.UniverseEndPage })),
);

import { Home } from "../views/Learn";
import { LegacyRedirect } from "./LegacyRedirect";

export default function HomePage() {
  return (
    <>
      <LegacyRedirect />
      <Home />
    </>
  );
}

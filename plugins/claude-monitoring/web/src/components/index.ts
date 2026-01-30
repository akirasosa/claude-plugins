// Register Lit components (side-effect imports)
// Components are registered via @customElement decorator

import "./event-row";
import "./events-table";
import "./status-badge";

// Re-export types for use in app.ts
export type { EventsTable } from "./events-table";
